import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApiHandler } from '../server/api.mjs';
import { demoReply, friends } from '../server/demo.mjs';

async function fixture(t, options = {}) {
  const handler = createApiHandler({ env: {}, ...options });
  const server = createServer((req, res) => {
    req.url = req.url.replace(/^\/api/, '');
    void handler(req, res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}/api`;
}
const payload = (friendId = 'aarav', text = 'It has been a long day') => ({
  friendId,
  messages: [{ role: 'user', text }],
  userName: 'Alex',
});

test('GET status accurately identifies demo mode', async (t) => {
  const url = await fixture(t);
  const response = await fetch(`${url}/status`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).mode, 'demo');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('all four friends reply in their own voice without an API key', async (t) => {
  const url = await fixture(t);
  const replies = [];
  for (const friend of friends) {
    const response = await fetch(`${url}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload(friend.id, 'I need a little motivation')),
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.mode, 'demo');
    assert.ok(data.reply.length > 30);
    replies.push(data.reply);
  }
  assert.equal(new Set(replies).size, 4);
});
test('invalid personas, message roles, empty messages, and oversized messages are rejected', async (t) => {
  const url = await fixture(t);
  for (const body of [
    payload('unknown'),
    payload('aarav', ''),
    { friendId: 'aarav', messages: [{ role: 'system', text: 'hi' }] },
    payload('aarav', 'x'.repeat(4001)),
    { friendId: 'aarav', messages: [] },
  ]) {
    const response = await fetch(`${url}/chat`, { method: 'POST', body: JSON.stringify(body) });
    assert.equal(response.status, 400);
  }
});
test('invalid JSON, wrong methods, and unknown endpoints have clear errors', async (t) => {
  const url = await fixture(t);
  assert.equal((await fetch(`${url}/chat`, { method: 'POST', body: '{' })).status, 400);
  assert.equal((await fetch(`${url}/chat`)).status, 405);
  assert.equal((await fetch(`${url}/missing`)).status, 404);
});
test('oversized requests are bounded', async (t) => {
  const url = await fixture(t);
  const response = await fetch(`${url}/chat`, {
    method: 'POST',
    body: JSON.stringify({ data: 'x'.repeat(3 * 1024 * 1024 + 1024) }),
  });
  assert.equal(response.status, 413);
});
test('rate limiting returns a retry header', async (t) => {
  const url = await fixture(t);
  let final;
  for (let i = 0; i < 31; i++) final = await fetch(`${url}/chat`, { method: 'POST', body: '{}' });
  assert.equal(final.status, 429);
  assert.ok(Number(final.headers.get('retry-after')) > 0);
});
test('live mode uses server-side credentials and a persona-specific system prompt', async (t) => {
  let request;
  const url = await fixture(t, {
    env: { AI_API_KEY: 'server-only-test-key', AI_MODEL: 'test-model' },
    fetch: async (url, options) => {
      request = { url: String(url), options };
      return Response.json({
        choices: [{ message: { content: 'Hello from the test provider.' } }],
      });
    },
  });
  const response = await fetch(`${url}/chat`, {
    method: 'POST',
    body: JSON.stringify(payload('ananya')),
  });
  const body = await response.json();
  assert.equal(body.mode, 'live');
  assert.equal(body.reply, 'Hello from the test provider.');
  assert.equal(request.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(request.options.headers.Authorization, 'Bearer server-only-test-key');
  const upstreamBody = JSON.parse(request.options.body);
  assert.match(upstreamBody.messages[0].content, /Ananya/);
  assert.match(upstreamBody.messages[0].content, /fictional AI/);
  assert.equal(upstreamBody.model, 'test-model');
  assert.ok(!JSON.stringify(body).includes('server-only-test-key'));
});
test('upstream failures do not expose provider details or keys', async (t) => {
  const url = await fixture(t, {
    env: { AI_API_KEY: 'secret' },
    fetch: async () => new Response('secret upstream error', { status: 401 }),
  });
  const response = await fetch(`${url}/chat`, { method: 'POST', body: JSON.stringify(payload()) });
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes('secret'));
});
test('non-HTTPS remote AI endpoints are refused', async (t) => {
  const url = await fixture(t, {
    env: { AI_API_KEY: 'secret', AI_BASE_URL: 'http://example.com/v1' },
  });
  assert.equal(
    (await fetch(`${url}/chat`, { method: 'POST', body: JSON.stringify(payload()) })).status,
    503,
  );
});
test('demo supports Hindi requests transparently and crisis messages prioritize real support', () => {
  assert.match(
    demoReply('aarav', [{ role: 'user', text: 'Mujhe hindi mein baat karni hai' }]),
    /हिंदी/,
  );
  const crisis = demoReply('ananya', [{ role: 'user', text: 'I want to kill myself' }]);
  assert.match(crisis, /112/);
  assert.match(crisis, /14416/);
});
test('demo remembers a name within the supplied conversation', () => {
  const reply = demoReply('aarav', [
    { role: 'user', text: 'My name is Rohan. Just wanted to share my thoughts.' },
  ]);
  assert.match(reply, /Rohan/);
});
