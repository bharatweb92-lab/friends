import { friends, demoReply } from './demo.mjs';
import { bearerToken, getSharedStore, sameOrigin } from './credentials.mjs';
import { chatPrompt, CHAT_MODEL, LIVE_MODEL } from './prompts.mjs';
import { generateGeminiText } from './gemini.mjs';

const MAX_BODY = 3 * 1024 * 1024;
const MAX_MESSAGES = 24;
const MAX_LENGTH = 4000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function json(res, status, value) {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(JSON.stringify(value));
}
async function readJson(req) {
  // Vercel's Node adapter may parse JSON before invoking the handler.
  if (req.body !== undefined) {
    if (typeof req.body === 'object' && req.body !== null) return req.body;
    const text = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body);
    if (Buffer.byteLength(text) > MAX_BODY) {
      const error = new Error('Request too large');
      error.status = 413;
      throw error;
    }
    try {
      return JSON.parse(text);
    } catch {
      const error = new Error('Invalid JSON');
      error.status = 400;
      throw error;
    }
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) {
      const error = new Error('Request too large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Invalid JSON');
    error.status = 400;
    throw error;
  }
}
function validMessages(messages) {
  return (
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.length <= MAX_MESSAGES &&
    messages.every(
      (m) =>
        m &&
        ['user', 'assistant'].includes(m.role) &&
        typeof m.text === 'string' &&
        m.text.length <= MAX_LENGTH &&
        (!m.image ||
          (['image/jpeg', 'image/png', 'image/webp'].includes(m.image.mime) &&
            typeof m.image.data === 'string' &&
            m.image.data.length <= 1_500_000 &&
            /^[A-Za-z0-9+/]+={0,2}$/.test(m.image.data))),
    ) &&
    messages.at(-1).role === 'user' &&
    (messages.at(-1).text.trim().length > 0 || messages.at(-1).image)
  );
}

export function createApiHandler(options = {}) {
  const env = options.env ?? process.env;
  const fetcher = options.fetch ?? globalThis.fetch;
  const store = options.store ?? getSharedStore();
  const requests = new Map();
  const connectionAttempts = new Map();
  const chatModel = env.GEMINI_CHAT_MODEL || CHAT_MODEL;
  const liveModel = env.GEMINI_LIVE_MODEL || LIVE_MODEL;
  const envGemini = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  const envOpenAI = env.AI_API_KEY || env.OPENAI_API_KEY;
  const deployment = options.deployment || 'node';
  const liveSupported = options.liveAvailable !== false;
  const sessionMode = options.sessionMode || store.mode || 'memory';
  function rateLimit(map, ip, max) {
    const now = Date.now();
    for (const [key, value] of map) if (value.reset < now) map.delete(key);
    const value = map.get(ip) ?? { count: 0, reset: now + 60_000 };
    value.count++;
    map.set(ip, value);
    return value.count > max;
  }
  function status(req) {
    const session = store.get(bearerToken(req));
    const provider = session || envGemini ? 'gemini' : envOpenAI ? 'openai' : 'demo';
    return {
      mode: provider === 'demo' ? 'demo' : 'live',
      provider,
      geminiConnected: provider === 'gemini',
      liveAvailable: provider === 'gemini' && liveSupported,
      deployment,
      sessionMode,
      ...(provider === 'gemini' && !liveSupported
        ? {
            liveUnavailableReason:
              'Live voice/video calls need the Yaari Node WebSocket server. This Vercel deployment supports Gemini chat and photo sharing.',
          }
        : {}),
      source: session ? 'session' : provider === 'demo' ? 'none' : 'server',
      chatModel:
        provider === 'gemini'
          ? chatModel
          : provider === 'openai'
            ? env.AI_MODEL || 'gpt-4.1-mini'
            : undefined,
      liveModel: provider === 'gemini' ? liveModel : undefined,
      expiresAt: session?.expiresAt,
    };
  }
  return async function handler(req, res) {
    const path = (req.url ?? '').split('?')[0].replace(/\/$/, '');
    const ip = req.socket?.remoteAddress ?? 'local';
    if (path === '/status' && req.method === 'GET') return json(res, 200, status(req));
    if (path === '/gemini/connect') {
      if (req.method !== 'POST') return json(res, 405, { error: 'Use POST to connect.' });
      if (!sameOrigin(req))
        return json(res, 403, { error: 'Open Settings from this app to connect your key.' });
      if (rateLimit(connectionAttempts, ip, 6))
        return json(res, 429, { error: 'Too many connection attempts. Please wait a minute.' });
      try {
        const body = await readJson(req);
        const key = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
        if (key.length < 20 || key.length > 200 || /\s/.test(key))
          return json(res, 400, { error: 'Enter a valid Gemini API key from Google AI Studio.' });
        try {
          // Prove generation works, not just that model metadata is readable.
          // This tiny check can use a small amount of the user's Gemini quota.
          await generateGeminiText({
            apiKey: key,
            model: chatModel,
            contents: 'Reply with exactly OK.',
            fetcher,
            deadlineMs: 18_000,
            attemptTimeoutMs: 15_000,
            maxOutputTokens: 512,
            temperature: 0,
            attempts: 1,
          });
        } catch (error) {
          return json(res, error.status || 502, { error: error.message });
        }
        store.delete(bearerToken(req));
        const session = store.create(key);
        return json(res, 200, {
          ...status({ headers: { authorization: `Bearer ${session.token}` } }),
          token: session.token,
        });
      } catch (error) {
        return json(res, error.status || 500, {
          error:
            error.status === 413
              ? 'That request is too large.'
              : 'The key could not be connected. Please try again.',
        });
      }
    }
    if (path === '/gemini/disconnect') {
      if (req.method !== 'POST') return json(res, 405, { error: 'Use POST to disconnect.' });
      if (!sameOrigin(req)) return json(res, 403, { error: 'Request origin was not accepted.' });
      store.delete(bearerToken(req));
      return json(res, 200, status({ headers: {} }));
    }
    if (path !== '/chat') return json(res, 404, { error: 'Not found.' });
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return json(res, 405, { error: 'Use POST for chat.' });
    }
    if (!sameOrigin(req)) return json(res, 403, { error: 'Request origin was not accepted.' });
    if (rateLimit(requests, ip, 30)) {
      res.setHeader('Retry-After', '60');
      return json(res, 429, { error: 'A little breather! Please try again in a minute.' });
    }
    try {
      const body = await readJson(req);
      const friend = friends.find((f) => f.id === body?.friendId);
      if (!friend || !validMessages(body.messages))
        return json(res, 400, {
          error:
            'Choose a friend and send a message or supported photo (up to 24 recent messages).',
        });
      const userName = typeof body.userName === 'string' ? body.userName.slice(0, 50) : '';
      const key = store.get(bearerToken(req))?.key || envGemini;
      if (key) {
        const contents = body.messages.map((m, index) => {
          const parts = [];
          if (m.text) parts.push({ text: m.text });
          if (m.role === 'user' && m.image && index === body.messages.length - 1)
            parts.push({ inlineData: { mimeType: m.image.mime, data: m.image.data } });
          return { role: m.role === 'assistant' ? 'model' : 'user', parts };
        });
        try {
          const result = await generateGeminiText({
            apiKey: key,
            model: chatModel,
            contents,
            systemInstruction: chatPrompt(friend, userName),
            fetcher,
          });
          return json(res, 200, { reply: result.text, mode: 'live', provider: 'gemini' });
        } catch (error) {
          return json(res, error.status || 502, { error: error.message, code: error.code });
        }
      }
      if (envOpenAI) {
        const base = (env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
        const url = new URL(`${base}/chat/completions`);
        if (
          url.protocol !== 'https:' &&
          !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
        )
          return json(res, 503, { error: 'The AI connection needs an HTTPS provider URL.' });
        let upstream;
        try {
          upstream = await fetcher(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${envOpenAI}` },
            body: JSON.stringify({
              model: env.AI_MODEL || 'gpt-4.1-mini',
              messages: [
                { role: 'system', content: chatPrompt(friend, userName) },
                ...body.messages.map((m) => ({
                  role: m.role,
                  content: m.text || '[Attachment description only]',
                })),
              ],
              max_tokens: 450,
              temperature: 0.8,
            }),
            signal: AbortSignal.timeout(35_000),
          });
        } catch {
          return json(res, 502, {
            error: `${friend.name} couldn’t connect. Your message is saved — try again.`,
          });
        }
        if (!upstream.ok)
          return json(res, 502, {
            error: 'The AI provider is unavailable or its settings need attention.',
          });
        const result = await upstream.json();
        const reply = result.choices?.[0]?.message?.content;
        if (typeof reply !== 'string' || !reply.trim())
          return json(res, 502, { error: 'The AI sent an empty reply. Please try again.' });
        return json(res, 200, {
          reply: reply.trim().slice(0, 8000),
          mode: 'live',
          provider: 'openai',
        });
      }
      await sleep(700 + Math.floor(Math.random() * 500));
      return json(res, 200, {
        reply: demoReply(friend.id, body.messages, userName),
        mode: 'demo',
        provider: 'demo',
      });
    } catch (error) {
      return json(res, error.status || 500, {
        error:
          error.status === 413
            ? 'This photo is too large. Try a smaller image.'
            : error.status === 400
              ? 'The message could not be read.'
              : 'Something went wrong. Your message is saved — please try again.',
      });
    }
  };
}
