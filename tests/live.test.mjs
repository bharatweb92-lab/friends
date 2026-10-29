import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { attachLiveServer } from '../server/live.mjs';
import { createCredentialStore } from '../server/credentials.mjs';

async function fixture(t, options = {}) {
  const store = createCredentialStore();
  const session = store.create('server-only-test-key');
  const events = [];
  let fake;
  let upstreamCallbacks;
  const server = createServer();
  const live = attachLiveServer(server, {
    store,
    env: {},
    connect: async (config, callbacks) => {
      events.push({ type: 'connect', config });
      upstreamCallbacks = callbacks;
      fake = {
        close: () => events.push({ type: 'close' }),
        sendRealtimeInput: (input) => events.push({ type: 'input', input }),
        sendClientContent: (input) => events.push({ type: 'content', input }),
      };
      queueMicrotask(() => callbacks.onmessage({ setupComplete: {} }));
      return fake;
    },
    ...options,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `ws://127.0.0.1:${server.address().port}/api/live`;
  t.after(
    () =>
      new Promise((resolve) => {
        live.close();
        server.close(resolve);
      }),
  );
  return {
    url,
    token: session.token,
    store,
    events,
    live,
    callbacks: () => upstreamCallbacks,
    getFake: () => fake,
  };
}
function connect(url) {
  const ws = new WebSocket(url);
  const messages = [];
  ws.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
  return {
    ws,
    messages,
    ready: new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    }),
    next: async (type) => {
      for (let i = 0; i < 100; i++) {
        const found = messages.find((m) => m.type === type);
        if (found) return found;
        await new Promise((r) => setTimeout(r, 10));
      }
      throw new Error(`No ${type} message: ${JSON.stringify(messages)}`);
    },
  };
}
const start = (token) => ({
  type: 'start',
  token,
  friendId: 'meera',
  userName: 'Rohan',
  video: true,
  history: [],
});

test('live call requires a valid opaque session before accepting media', async (t) => {
  const f = await fixture(t);
  const c = connect(f.url);
  await c.ready;
  c.ws.send(JSON.stringify({ type: 'audio', data: 'AA==' }));
  const error = await c.next('error');
  assert.match(error.message, /Start the call/);
  assert.equal(f.events.length, 0);
});
test('live call forwards PCM and camera frames, forwards audio/transcripts, and closes upstream on hangup', async (t) => {
  const f = await fixture(t);
  const c = connect(f.url);
  await c.ready;
  c.ws.send(JSON.stringify(start(f.token)));
  await c.next('ready');
  assert.match(f.events[0].config.friend.prompt, /Meera/);
  assert.ok(f.events.some((e) => e.type === 'content'));
  const audio = Buffer.alloc(2048).toString('base64');
  const video = Buffer.from('test-camera-frame').toString('base64');
  c.ws.send(JSON.stringify({ type: 'audio', data: audio }));
  c.ws.send(JSON.stringify({ type: 'video', data: video }));
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(f.events.some((e) => e.input?.audio?.mimeType === 'audio/pcm;rate=16000'));
  assert.ok(f.events.some((e) => e.input?.video?.mimeType === 'image/jpeg'));
  f.callbacks().onmessage({
    serverContent: {
      modelTurn: {
        parts: [{ inlineData: { data: 'AACAAA==', mimeType: 'audio/pcm;rate=24000' } }],
      },
      outputTranscription: { text: 'Hello from the test friend.' },
      inputTranscription: { text: 'Hello from the test user.' },
    },
  });
  assert.equal((await c.next('audio')).data, 'AACAAA==');
  assert.ok((await c.next('transcript')).text.length > 0);
  f.callbacks().onmessage({ serverContent: { interrupted: true } });
  await c.next('interrupted');
  c.ws.send(JSON.stringify({ type: 'mediaState', mic: false, camera: false }));
  await new Promise((r) => setTimeout(r, 20));
  const before = f.events.length;
  c.ws.send(JSON.stringify({ type: 'audio', data: audio }));
  c.ws.send(JSON.stringify({ type: 'video', data: video }));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(f.events.length, before);
  assert.equal(f.live.activeCalls, 1);
  c.ws.close();
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(f.events.some((e) => e.type === 'close'));
  assert.equal(f.live.activeCalls, 0);
});
test('disconnecting Gemini revokes an active call', async (t) => {
  const f = await fixture(t);
  const c = connect(f.url);
  await c.ready;
  c.ws.send(JSON.stringify(start(f.token)));
  await c.next('ready');
  f.store.delete(f.token);
  const error = await c.next('error');
  assert.match(error.message, /Media sharing has stopped/);
  assert.ok(f.events.some((e) => e.type === 'close'));
});
test('unconfigured callers cannot start a real call', async (t) => {
  const f = await fixture(t);
  const c = connect(f.url);
  await c.ready;
  c.ws.send(JSON.stringify({ type: 'start', friendId: 'aarav' }));
  assert.match((await c.next('error')).message, /Connect your Gemini API key/);
});

test('ready and greeting wait for the upstream connect promise, not an early setup event', async (t) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const f = await fixture(t, {
    connect: async (config, callbacks) => {
      callbacks.onmessage({ setupComplete: {} });
      await gate;
      return {
        close: () => {},
        sendRealtimeInput: () => {},
        sendClientContent: (input) => f.events.push({ type: 'content', input }),
      };
    },
  });
  const c = connect(f.url);
  await c.ready;
  c.ws.send(JSON.stringify(start(f.token)));
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(!c.messages.some((m) => m.type === 'ready'));
  assert.ok(!f.events.some((e) => e.type === 'content'));
  release();
  await c.next('ready');
  assert.ok(f.events.some((e) => e.type === 'content'));
  c.ws.close();
});
