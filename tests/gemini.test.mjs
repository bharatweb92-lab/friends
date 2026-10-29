import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApiHandler } from '../server/api.mjs';
import { createCredentialStore } from '../server/credentials.mjs';

async function fixture(t, options = {}) {
  const store = createCredentialStore();
  const handler = createApiHandler({ env: {}, store, ...options });
  const server = createServer((req, res) => {
    req.url = req.url.replace(/^\/api/, '');
    void handler(req, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { url: `http://127.0.0.1:${server.address().port}/api`, store };
}
const key = 'test-gemini-key-not-a-real-credential';
const message = {
  friendId: 'aarav',
  userName: 'Rohan',
  messages: [
    {
      role: 'user',
      text: 'What can you see?',
      image: { mime: 'image/webp', data: Buffer.from('test-photo').toString('base64') },
    },
  ],
};

test('credential store uses opaque expiring ids and supports revocation', () => {
  const store = createCredentialStore({ ttl: 20 });
  const session = store.create(key);
  assert.notEqual(session.token, key);
  assert.equal(session.token.length, 43);
  assert.equal(store.get(session.token).key, key);
  let revoked = false;
  store.onRevoke(session.token, () => {
    revoked = true;
  });
  store.delete(session.token);
  assert.equal(store.get(session.token), undefined);
  assert.equal(revoked, true);
  assert.equal(store.get('placeholder'), undefined);
});
test('expired credentials are not accepted', async () => {
  const store = createCredentialStore({ ttl: 5 });
  const session = store.create(key);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(store.get(session.token), undefined);
});
test('Settings validates a Gemini key server-side and never returns it', async (t) => {
  let validation;
  const { url, store } = await fixture(t, {
    fetch: async (url, options) => {
      validation = { url: String(url), options };
      return Response.json({ name: 'models/gemini-flash-latest' });
    },
  });
  const response = await fetch(`${url}/gemini/connect`, {
    method: 'POST',
    body: JSON.stringify({ apiKey: key }),
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.geminiConnected, true);
  assert.equal(body.liveAvailable, true);
  assert.equal(body.source, 'session');
  assert.equal(validation.options.headers['x-goog-api-key'], key);
  assert.ok(!JSON.stringify(body).includes(key));
  assert.equal(store.get(body.token).key, key);
  const status = await (
    await fetch(`${url}/status`, { headers: { Authorization: `Bearer ${body.token}` } })
  ).json();
  assert.equal(status.provider, 'gemini');
});
test('invalid keys and cross-origin key submissions are rejected', async (t) => {
  const { url } = await fixture(t, { fetch: async () => new Response('invalid', { status: 403 }) });
  assert.equal(
    (
      await fetch(`${url}/gemini/connect`, {
        method: 'POST',
        body: JSON.stringify({ apiKey: key }),
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(`${url}/gemini/connect`, {
        method: 'POST',
        headers: { Origin: 'https://untrusted.example' },
        body: JSON.stringify({ apiKey: key }),
      })
    ).status,
    403,
  );
});
test('Gemini chat sends persona, language context, and the latest photo', async (t) => {
  let request;
  const { url } = await fixture(t, {
    env: { GEMINI_API_KEY: key },
    fetch: async (url, options) => {
      request = { url: String(url), options };
      return Response.json({
        candidates: [{ content: { parts: [{ text: 'I can see the photo you shared.' }] } }],
      });
    },
  });
  const response = await fetch(`${url}/chat`, { method: 'POST', body: JSON.stringify(message) });
  const body = await response.json();
  assert.equal(body.provider, 'gemini');
  assert.match(request.url, /gemini-flash-latest:generateContent/);
  const payload = JSON.parse(request.options.body);
  assert.match(payload.systemInstruction.parts[0].text, /Aarav/);
  assert.match(payload.systemInstruction.parts[0].text, /Hindi/);
  assert.equal(payload.contents[0].parts[1].inlineData.mimeType, 'image/webp');
  assert.equal(payload.contents[0].role, 'user');
});
test('disconnect removes the key and immediately restores demo status', async (t) => {
  const { url, store } = await fixture(t, { fetch: async () => Response.json({ name: 'model' }) });
  const session = await (
    await fetch(`${url}/gemini/connect`, { method: 'POST', body: JSON.stringify({ apiKey: key }) })
  ).json();
  const response = await fetch(`${url}/gemini/disconnect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}` },
  });
  assert.equal((await response.json()).mode, 'demo');
  assert.equal(store.size, 0);
});
test('Gemini provider errors preserve user data and do not leak credentials', async (t) => {
  const { url } = await fixture(t, {
    env: { GEMINI_API_KEY: key },
    fetch: async () => new Response(`error ${key}`, { status: 429 }),
  });
  const response = await fetch(`${url}/chat`, { method: 'POST', body: JSON.stringify(message) });
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes(key));
});

test('evicting the oldest credential revokes its active-call subscription', () => {
  const store = createCredentialStore({ maxSessions: 1 });
  const first = store.create(key);
  let revoked = false;
  store.onRevoke(first.token, () => {
    revoked = true;
  });
  store.create('another-server-only-test-key');
  assert.equal(store.get(first.token), undefined);
  assert.equal(revoked, true);
  assert.equal(store.size, 1);
});
