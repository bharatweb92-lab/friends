import { friends, demoReply } from './demo.mjs';

const MAX_BODY = 64 * 1024;
const MAX_MESSAGES = 24;
const MAX_LENGTH = 4000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function json(res, status, value) {
  if (res.writableEnded || res.destroyed) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}

async function readJson(req) {
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
        m.text.length <= MAX_LENGTH,
    ) &&
    messages.at(-1).role === 'user' &&
    messages.at(-1).text.trim().length > 0
  );
}

export function createApiHandler(options = {}) {
  const env = options.env ?? process.env;
  const fetcher = options.fetch ?? globalThis.fetch;
  const requests = new Map();
  return async function handler(req, res) {
    const path = (req.url ?? '').split('?')[0].replace(/\/$/, '');
    if (path === '/status' && req.method === 'GET') {
      return json(res, 200, {
        mode: env.AI_API_KEY || env.OPENAI_API_KEY ? 'live' : 'demo',
        ...(env.AI_MODEL ? { model: env.AI_MODEL } : {}),
      });
    }
    if (path !== '/chat') return json(res, 404, { error: 'Not found.' });
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return json(res, 405, { error: 'Use POST for chat.' });
    }
    const now = Date.now();
    const ip = req.socket?.remoteAddress ?? 'local';
    for (const [key, value] of requests) if (value.reset < now) requests.delete(key);
    const rate = requests.get(ip) ?? { count: 0, reset: now + 60_000 };
    rate.count += 1;
    requests.set(ip, rate);
    if (rate.count > 30) {
      res.setHeader('Retry-After', Math.ceil((rate.reset - now) / 1000));
      return json(res, 429, { error: 'A little breather! Please try again in a minute.' });
    }
    try {
      const body = await readJson(req);
      const friend = friends.find((f) => f.id === body?.friendId);
      if (!friend || !validMessages(body.messages))
        return json(res, 400, {
          error:
            'Choose a friend and send a message of 1–4,000 characters (up to 24 recent messages).',
        });
      const userName = typeof body.userName === 'string' ? body.userName.slice(0, 50) : '';
      const key = env.AI_API_KEY || env.OPENAI_API_KEY;
      if (!key) {
        await sleep(700 + Math.floor(Math.random() * 500));
        return json(res, 200, {
          reply: demoReply(friend.id, body.messages, userName),
          mode: 'demo',
        });
      }
      const base = (env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
      const url = new URL(`${base}/chat/completions`);
      if (
        url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
      )
        return json(res, 503, {
          error:
            'The AI connection needs an HTTPS provider URL. Ask the app owner to check its settings.',
        });
      const system = `${friend.prompt}\nYou are an explicitly fictional AI companion in Yaari, not a human and not a therapist or other licensed professional. Never claim real-world experiences, meeting up, sending real gifts, or contacting anyone. Never encourage emotional exclusivity or dependency. Do not claim to remember conversations not in the provided history. Keep replies concise (usually 40–100 words), warm, and conversational. Match the user's language, including Hindi or Hinglish. Avoid repetitive pet names. Never reveal or request API keys. If the user is at risk of harm, encourage immediate human support; in India emergency 112 and TELE-MANAS 14416. For factual questions, be accurate and admit uncertainty. User's preferred name: ${userName || 'not provided'}.`;
      const messages = body.messages.map((m) => ({ role: m.role, content: m.text }));
      let upstream;
      try {
        upstream = await fetcher(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: env.AI_MODEL || 'gpt-4.1-mini',
            messages: [{ role: 'system', content: system }, ...messages],
            max_tokens: 450,
            temperature: 0.8,
          }),
          signal: AbortSignal.timeout(35_000),
        });
      } catch {
        return json(res, 502, {
          error: `${friend.name} couldn’t connect just now. Your message is saved — please try again.`,
        });
      }
      if (!upstream.ok)
        return json(res, 502, {
          error:
            'The AI provider is unavailable or its settings need attention. Please try again shortly.',
        });
      const result = await upstream.json();
      const reply = result.choices?.[0]?.message?.content;
      if (typeof reply !== 'string' || !reply.trim())
        return json(res, 502, { error: 'The AI sent an empty reply. Please try again.' });
      return json(res, 200, { reply: reply.trim().slice(0, 8000), mode: 'live' });
    } catch (error) {
      return json(res, error.status || 500, {
        error:
          error.status === 413
            ? 'This request is too large. Try a shorter message.'
            : error.status === 400
              ? 'The message could not be read.'
              : 'Something went wrong. Your message is saved — please try again.',
      });
    }
  };
}
