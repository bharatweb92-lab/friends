import { createApiHandler } from './api.mjs';
import { createEncryptedCredentialStore } from './credentials.mjs';

const secret = process.env.YAARI_SESSION_SECRET;
const store = secret ? createEncryptedCredentialStore({ secret }) : undefined;
const handler = createApiHandler({
  store,
  deployment: 'vercel',
  liveAvailable: false,
  sessionMode: 'encrypted',
});

function json(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(value));
}

export default async function vercelApi(req, res) {
  const url = new URL(req.url || '/', 'http://vercel.local');
  const path = url.pathname.replace(/^\/api/, '') || '/';
  if (path === '/health' && req.method === 'GET') {
    try {
      const probe = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        signal: AbortSignal.timeout(8_000),
      });
      return json(res, 200, { ok: true, geminiReachable: true, probeStatus: probe.status });
    } catch (error) {
      return json(res, 200, {
        ok: true,
        geminiReachable: false,
        probeError:
          error?.name === 'TimeoutError'
            ? 'timeout'
            : error?.cause?.code || error?.code || 'network',
      });
    }
  }
  if (path === '/live' || path.startsWith('/live/'))
    return json(res, 501, {
      error:
        'Live voice/video calls are not available on Vercel because they require a long-running WebSocket server. Gemini chat is available here; deploy the Node server for calls.',
    });
  if (!secret && (path === '/gemini/connect' || path === '/gemini/disconnect'))
    return json(res, 503, {
      error:
        'The app owner must configure YAARI_SESSION_SECRET in Vercel before browser key sessions can be used.',
    });
  req.url = `${path}${url.search}`;
  return handler(req, res);
}
