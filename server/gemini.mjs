import { GoogleGenAI, ThinkingLevel } from '@google/genai';

/** A safe, user-facing Gemini failure. Never include provider bodies or keys. */
export class GeminiError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
    this.status = status;
  }
}

function safeFailure(error) {
  if (error instanceof GeminiError) return error;
  const status = Number(error?.status);
  if (status === 400 || status === 401 || status === 403)
    return new GeminiError(
      'GEMINI_ACCESS',
      'Gemini rejected the request. Check your key, API restrictions, and model access in Settings.',
      401,
    );
  if (status === 404)
    return new GeminiError(
      'GEMINI_MODEL',
      'The configured Gemini chat model is not available to this key. Check the model in Settings or the server configuration.',
    );
  if (status === 429)
    return new GeminiError(
      'GEMINI_QUOTA',
      'Gemini’s usage limit was reached. Check your project quota and billing, then try again.',
      429,
    );
  if (status >= 500 && status < 600)
    return new GeminiError(
      'GEMINI_UNAVAILABLE',
      'Gemini is temporarily unavailable. Your message is saved — please try again shortly.',
    );
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError')
    return new GeminiError(
      'GEMINI_TIMEOUT',
      'Gemini took too long to prepare a reply. Your message is saved — please try again.',
      504,
    );
  return new GeminiError(
    'GEMINI_NETWORK',
    'The app server couldn’t complete the Gemini request. Your message is saved — please try again.',
  );
}

function logFailure(error, failure, meta) {
  // Only non-secret diagnostics. Never log the key, prompt, photo, or provider body.
  console.error('Gemini generation failed', {
    code: failure.code,
    upstreamStatus: Number(error?.status) || undefined,
    errorName: error?.name,
    networkCode: error?.cause?.code || error?.code,
    ...meta,
  });
}

function makeClient({ apiKey, fetcher, timeout, attempts }) {
  return new GoogleGenAI({
    apiKey,
    vertexai: false,
    httpOptions: {
      apiVersion: 'v1beta',
      timeout,
      fetch: fetcher,
      retryOptions: {
        attempts,
        initialDelay: 0.4,
        maxDelay: 1,
        jitter: 0.2,
        // Do not burn the user's quota retrying an exhausted quota.
        httpStatusCodes: [408, 500, 502, 503, 504],
      },
    },
  });
}

function baseConfig({ systemInstruction, temperature, maxOutputTokens, abortSignal }) {
  return {
    ...(systemInstruction ? { systemInstruction } : {}),
    temperature,
    maxOutputTokens,
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    // A chat turn must stay one bounded request. The SDK otherwise may send
    // continuation requests automatically, each with its own timeout/billing.
    automaticContinuation: false,
    automaticFunctionCalling: { disable: true },
    ...(abortSignal ? { abortSignal } : {}),
  };
}

function visibleText(response) {
  return (response?.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => typeof part.text === 'string' && !part.thought)
    .map((part) => part.text)
    .join('');
}

function isBlocked(response) {
  return (
    response?.candidates?.[0]?.finishReason === 'SAFETY' ||
    Boolean(response?.promptFeedback?.blockReason)
  );
}

function emptyError(blocked) {
  return new GeminiError(
    blocked ? 'GEMINI_BLOCKED' : 'GEMINI_EMPTY',
    blocked
      ? 'Gemini couldn’t answer that message safely. Try rephrasing it.'
      : 'Gemini returned no visible reply. Please try again.',
  );
}

/** Non-streaming generation, used for the tiny connect check and JSON fallback. */
export async function generateGeminiText({
  apiKey,
  model,
  contents,
  systemInstruction,
  fetcher = globalThis.fetch,
  deadlineMs = 35_000,
  attemptTimeoutMs = 18_000,
  maxOutputTokens = 1024,
  temperature = 0.8,
  attempts = 2,
}) {
  const started = Date.now();
  const client = makeClient({ apiKey, fetcher, timeout: attemptTimeoutMs, attempts });
  try {
    const response = await client.models.generateContent({
      model,
      contents,
      config: baseConfig({
        systemInstruction,
        temperature,
        maxOutputTokens,
        abortSignal: AbortSignal.timeout(deadlineMs),
      }),
    });
    const text = visibleText(response).trim();
    if (!text || isBlocked(response)) throw emptyError(isBlocked(response));
    return {
      text: text.slice(0, 8000),
      model,
      finishReason: response.candidates?.[0]?.finishReason,
    };
  } catch (error) {
    const failure = safeFailure(error);
    logFailure(error, failure, { elapsedMs: Date.now() - started, mode: 'unary' });
    throw failure;
  }
}

async function nextWithIdle(iterator, idleTimeoutMs, controller) {
  let timer;
  try {
    return await Promise.race([
      iterator.next(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new DOMException('Gemini stream stalled', 'TimeoutError');
          controller.abort(error);
          reject(error);
        }, idleTimeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Stream visible reply text. Thoughts are never forwarded. The idle timeout is
 * reset by each upstream chunk; a separate deadline bounds the whole turn.
 */
export async function streamGeminiText({
  apiKey,
  model,
  contents,
  systemInstruction,
  fetcher = globalThis.fetch,
  onDelta,
  deadlineMs = 55_000,
  idleTimeoutMs = 25_000,
  maxOutputTokens = 1024,
  temperature = 0.8,
}) {
  const started = Date.now();
  const controller = new AbortController();
  const deadline = setTimeout(
    () => controller.abort(new DOMException('Gemini reply deadline reached', 'TimeoutError')),
    deadlineMs,
  );
  const client = makeClient({ apiKey, fetcher, timeout: deadlineMs, attempts: 1 });
  let iterator;
  let chunks = 0;
  let text = '';
  try {
    const stream = await client.models.generateContentStream({
      model,
      contents,
      config: {
        ...baseConfig({ systemInstruction, temperature, maxOutputTokens }),
        abortSignal: controller.signal,
        httpOptions: { timeout: deadlineMs, retryOptions: { attempts: 1 } },
      },
    });
    iterator = stream[Symbol.asyncIterator]();
    let finishReason;
    let blocked = false;
    while (true) {
      const step = await nextWithIdle(iterator, idleTimeoutMs, controller);
      if (step.done) break;
      chunks++;
      const chunk = step.value;
      blocked = blocked || isBlocked(chunk);
      if (blocked) throw emptyError(true);
      finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason;
      const delta = visibleText(chunk);
      if (delta) {
        text += delta;
        onDelta?.(delta);
      }
      if (text.length >= 8000) {
        text = text.slice(0, 8000);
        break;
      }
    }
    text = text.trim();
    if (!text || blocked || finishReason === 'SAFETY')
      throw emptyError(blocked || finishReason === 'SAFETY');
    return { text, model, finishReason, elapsedMs: Date.now() - started, chunks };
  } catch (error) {
    const failure = safeFailure(error);
    logFailure(error, failure, {
      elapsedMs: Date.now() - started,
      mode: 'stream',
      chunks,
      visibleChars: text.length,
    });
    throw failure;
  } finally {
    clearTimeout(deadline);
    controller.abort();
    try {
      // Do not await a stalled upstream iterator while cleaning up; the abort
      // signal above closes the real fetch, and this releases SDK resources.
      const closing = iterator?.return?.();
      closing?.catch?.(() => {});
    } catch {
      /* The upstream stream may already be closed. */
    }
  }
}
