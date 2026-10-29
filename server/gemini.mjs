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

/**
 * Use Google's maintained SDK rather than hand-rolling protocol details.
 * Low thinking is important for a messaging UI: the default reasoning level can
 * spend the entire output budget thinking and leave no visible reply.
 */
export async function generateGeminiText({
  apiKey,
  model,
  contents,
  systemInstruction,
  fetcher = globalThis.fetch,
  deadlineMs = 35_000,
  attemptTimeoutMs = 18_000,
  maxOutputTokens = 2048,
  temperature = 0.8,
  attempts = 2,
}) {
  const client = new GoogleGenAI({
    apiKey,
    vertexai: false,
    httpOptions: {
      apiVersion: 'v1beta',
      timeout: attemptTimeoutMs,
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
  try {
    const response = await client.models.generateContent({
      model,
      contents,
      config: {
        ...(systemInstruction ? { systemInstruction } : {}),
        temperature,
        maxOutputTokens,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        abortSignal: AbortSignal.timeout(deadlineMs),
      },
    });
    const candidate = response.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .filter((part) => typeof part.text === 'string' && !part.thought)
      .map((part) => part.text)
      .join('')
      .trim();
    if (!text) {
      const blocked = candidate?.finishReason === 'SAFETY' || response.promptFeedback?.blockReason;
      throw new GeminiError(
        blocked ? 'GEMINI_BLOCKED' : 'GEMINI_EMPTY',
        blocked
          ? 'Gemini couldn’t answer that message safely. Try rephrasing it.'
          : 'Gemini returned no visible reply. Please try again.',
      );
    }
    return { text: text.slice(0, 8000), model, finishReason: candidate?.finishReason };
  } catch (error) {
    const failure = safeFailure(error);
    // Only non-secret diagnostics. Never log the key, prompt, photo, or provider body.
    console.error('Gemini generation failed', {
      code: failure.code,
      upstreamStatus: Number(error?.status) || undefined,
      errorName: error?.name,
      networkCode: error?.cause?.code || error?.code,
    });
    throw failure;
  }
}
