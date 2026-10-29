import { createApiHandler } from '../server/api.mjs';
import { createEncryptedCredentialStore } from '../server/credentials.mjs';

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
