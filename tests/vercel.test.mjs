import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { createEncryptedCredentialStore } from '../server/credentials.mjs';

const secret = randomBytes(32).toString('base64url');

async function fixture(t, handler) {
  const server = createServer((req, res) => void handler(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}
const post = (url, body, headers = {}) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

test('encrypted serverless sessions survive across independent handler instances', () => {
  const a = createEncryptedCredentialStore({ secret });
  const b = createEncryptedCredentialStore({ secret });
  const key = 'AIzaSyDUMMY_TEST_KEY_1234567890';
  const { token, expiresAt } = a.create(key);
  assert.match(token, /^yaari1\./);
  assert.ok(!token.includes(key));
  assert.equal(b.get(token).key, key);
  assert.equal(b.get(token).expiresAt, expiresAt);
  assert.equal(b.get(`${token}x`), undefined);
  assert.equal(b.get(token.replace('yaari1.', 'yaari2.')), undefined);
  const other = createEncryptedCredentialStore({ secret: randomBytes(32).toString('base64url') });
  assert.equal(other.get(token), undefined);
  const expired = createEncryptedCredentialStore({ secret, ttl: -1 });
  assert.equal(b.get(expired.create(key).token), undefined);
});

test('Vercel adapter reports chat-only hosting and keeps key sessions across instances', async (t) => {
  const previous = process.env.YAARI_SESSION_SECRET;
  const originalFetch = globalThis.fetch;
  process.env.YAARI_SESSION_SECRET = secret;
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    if (!target.startsWith('https://generativelanguage.googleapis.com/'))
      return originalFetch(url, init);
    if (target.includes(':generateContent')) {
      assert.equal(init.headers['x-goog-api-key'], 'AIzaSyDUMMY_VERCEL_KEY_1234567890');
      return Response.json({
        candidates: [{ content: { parts: [{ text: 'Hello from Vercel' }] } }],
      });
    }
    assert.equal(init.headers['x-goog-api-key'], 'AIzaSyDUMMY_VERCEL_KEY_1234567890');
    return Response.json({ name: 'models/gemini-flash-latest' });
  };
  try {
    const { default: handler } = await import('../server/vercel.mjs');
    const { default: connectRoute } = await import('../api/gemini/connect.mjs');
    const { default: disconnectRoute } = await import('../api/gemini/disconnect.mjs');
    assert.equal(connectRoute, handler);
    assert.equal(disconnectRoute, handler);
    const one = await fixture(t, handler);
    const two = await fixture(t, handler);
    const status = await (await fetch(`${one}/api/status`)).json();
    assert.equal(status.deployment, 'vercel');
    assert.equal(status.liveAvailable, false);
    const live = await fetch(`${one}/api/live`);
    assert.equal(live.status, 501);
    const connected = await post(`${one}/api/gemini/connect`, {
      apiKey: 'AIzaSyDUMMY_VERCEL_KEY_1234567890',
    });
    const session = await connected.json();
    assert.equal(connected.status, 200);
    assert.equal(session.provider, 'gemini');
    assert.equal(session.liveAvailable, false);
    assert.match(session.token, /^yaari1\./);
    const chat = await post(
      `${two}/api/chat`,
      { friendId: 'aarav', messages: [{ role: 'user', text: 'Hi' }] },
      { Authorization: `Bearer ${session.token}` },
    );
    assert.equal(chat.status, 200);
    assert.equal((await chat.json()).reply, 'Hello from Vercel');
    const disconnected = await post(
      `${two}/api/gemini/disconnect`,
      {},
      { Authorization: `Bearer ${session.token}` },
    );
    assert.equal(disconnected.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.YAARI_SESSION_SECRET;
    else process.env.YAARI_SESSION_SECRET = previous;
  }
});
