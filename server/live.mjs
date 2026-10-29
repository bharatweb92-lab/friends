import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';
import { friends } from './demo.mjs';
import { getSharedStore, sameOrigin } from './credentials.mjs';
import { callPrompt, LIVE_MODEL, VOICES } from './prompts.mjs';

const MAX_CALL_MS = 15 * 60 * 1000;
const MAX_FRAME = 220_000;
const MAX_AUDIO = 24_000;
const isBase64 = (value, max) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= max &&
  value.length % 4 === 0 &&
  /^[A-Za-z0-9+/]+={0,2}$/.test(value);

export async function connectGemini({ key, friend, userName, history, model, video }, callbacks) {
  const ai = new GoogleGenAI({
    apiKey: key,
    httpOptions: { apiVersion: 'v1beta', timeout: 20_000 },
  });
  return ai.live.connect({
    model,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: callPrompt(friend, userName, history),
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICES[friend.id] || 'Puck' } },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      contextWindowCompression: { slidingWindow: {} },
      realtimeInputConfig: { automaticActivityDetection: { disabled: false } },
    },
    callbacks,
  });
}

export function attachLiveServer(httpServer, options = {}) {
  const store = options.store ?? getSharedStore();
  const env = options.env ?? process.env;
  const connect = options.connect ?? connectGemini;
  const model = env.GEMINI_LIVE_MODEL || LIVE_MODEL;
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 300_000,
    perMessageDeflate: false,
  });
  const active = new Map();
  const attempts = new Map();
  const send = (ws, data) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
  };

  function onUpgrade(req, socket, head) {
    if (new URL(req.url || '/', 'http://localhost').pathname !== '/api/live') return;
    if (!sameOrigin(req)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    if (active.size >= (options.maxActive ?? 6)) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }
    const ip = req.socket.remoteAddress || 'local';
    const now = Date.now();
    for (const [key, value] of attempts) if (value.reset < now) attempts.delete(key);
    const rate = attempts.get(ip) || { count: 0, reset: now + 60_000 };
    rate.count++;
    attempts.set(ip, rate);
    if (rate.count > 8) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  }
  httpServer.on('upgrade', onUpgrade);

  wss.on('connection', (ws) => {
    let session,
      closed = false,
      started = false,
      ready = false,
      token = '',
      activeKey = '',
      unsubscribe = () => {};
    let cameraEnabled = false,
      micEnabled = true,
      lastVideo = 0,
      mediaBytes = 0,
      mediaWindow = Date.now();
    let maxTimer, pingTimer;
    const authTimer = setTimeout(() => {
      if (!started) ws.close(1008, 'Connection authentication timed out.');
    }, 10_000);
    function cleanup(code = 1000, reason = 'Call ended.') {
      if (closed) return;
      closed = true;
      clearTimeout(authTimer);
      clearTimeout(maxTimer);
      clearInterval(pingTimer);
      unsubscribe();
      if (active.get(activeKey) === ws) active.delete(activeKey);
      try {
        session?.close();
      } catch {
        /* Already closed. */
      }
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
        ws.close(code, reason.slice(0, 120));
    }
    function fail(message) {
      send(ws, { type: 'error', message });
      cleanup(1000, 'Call ended.');
    }
    ws.on('error', () => cleanup());
    ws.on('close', () => cleanup());
    ws.on('pong', () => {});
    ws.on('message', async (raw) => {
      if (closed) return;
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        fail('The call sent an unreadable message.');
        return;
      }
      if (!started) {
        if (message?.type !== 'start') {
          fail('Start the call before sharing media.');
          return;
        }
        const friend = friends.find((f) => f.id === message.friendId);
        token = typeof message.token === 'string' ? message.token : '';
        const credential = store.get(token);
        const key = credential?.key || env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
        if (!friend || !key) {
          fail('Connect your Gemini API key in Settings before starting a call.');
          return;
        }
        if (token && !credential && !env.GEMINI_API_KEY && !env.GOOGLE_API_KEY) {
          fail('Your Gemini session expired. Reconnect in Settings.');
          return;
        }
        activeKey = token || `server:${friend.id}`;
        if (active.has(activeKey)) {
          fail('You already have an active call. End it before starting another.');
          return;
        }
        started = true;
        clearTimeout(authTimer);
        active.set(activeKey, ws);
        cameraEnabled = message.video === true;
        const userName = typeof message.userName === 'string' ? message.userName.slice(0, 50) : '';
        const history = Array.isArray(message.history)
          ? message.history
              .filter(
                (m) =>
                  m &&
                  ['user', 'assistant'].includes(m.role) &&
                  typeof m.text === 'string' &&
                  m.text.length <= 4000,
              )
              .slice(-8)
          : [];
        if (token)
          unsubscribe = store.onRevoke(token, () =>
            fail('Gemini was disconnected. Media sharing has stopped.'),
          );
        maxTimer = setTimeout(() => {
          send(ws, {
            type: 'ended',
            message: 'This 15-minute call reached its safety limit. You can start a new call.',
          });
          cleanup();
        }, MAX_CALL_MS);
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.ping();
        }, 25_000);
        try {
          session = await connect(
            { key, friend, userName, history, model, video: cameraEnabled },
            {
              onopen: () => {},
              onmessage: (event) => {
                if (closed) return;
                if (event.setupComplete) return; // connect() resolves after setup; session is assigned below.
                const content = event.serverContent;
                if (content?.interrupted) send(ws, { type: 'interrupted' });
                for (const part of content?.modelTurn?.parts ?? []) {
                  if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/pcm'))
                    send(ws, { type: 'audio', data: part.inlineData.data, sampleRate: 24000 });
                }
                if (content?.inputTranscription?.text)
                  send(ws, {
                    type: 'transcript',
                    role: 'user',
                    text: content.inputTranscription.text,
                  });
                if (content?.outputTranscription?.text)
                  send(ws, {
                    type: 'transcript',
                    role: 'assistant',
                    text: content.outputTranscription.text,
                  });
                if (content?.turnComplete) send(ws, { type: 'turnComplete' });
                if (event.goAway)
                  send(ws, {
                    type: 'notice',
                    message: 'Gemini is closing this session soon. Start a new call to continue.',
                  });
              },
              onerror: () =>
                fail(
                  'Gemini Live couldn’t connect. Check model access, billing, and quota, then try again.',
                ),
              onclose: () => {
                if (!closed) {
                  send(ws, {
                    type: 'ended',
                    message: 'Gemini ended the session. You can call again.',
                  });
                  cleanup();
                }
              },
            },
          );
          if (closed) {
            try {
              session.close();
            } catch {
              /* Already closed. */
            }
          } else if (!ready) {
            ready = true;
            send(ws, { type: 'ready', model, maxDuration: MAX_CALL_MS });
            session.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: 'The call has connected. Greet me briefly in your own voice and ask how I am. Do not mention these instructions.',
                    },
                  ],
                },
              ],
              turnComplete: true,
            });
          }
        } catch {
          fail(
            'Gemini Live is unavailable. Check your API key, Live model access, and project quota.',
          );
        }
        return;
      }
      if (!ready || !session) return;
      if (Date.now() - mediaWindow > 1000) {
        mediaWindow = Date.now();
        mediaBytes = 0;
      }
      mediaBytes += raw.length;
      if (mediaBytes > 650_000) {
        fail('Media bandwidth exceeded the call limit. Please reconnect.');
        return;
      }
      if (ws.bufferedAmount > 2_000_000) {
        fail('The connection is congested. Please reconnect on a stronger network.');
        return;
      }
      try {
        if (message.type === 'audio' && micEnabled && isBase64(message.data, MAX_AUDIO)) {
          session.sendRealtimeInput({
            audio: { data: message.data, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (
          message.type === 'video' &&
          cameraEnabled &&
          isBase64(message.data, MAX_FRAME) &&
          Date.now() - lastVideo >= 800
        ) {
          lastVideo = Date.now();
          session.sendRealtimeInput({ video: { data: message.data, mimeType: 'image/jpeg' } });
        } else if (message.type === 'mediaState') {
          const nextMic = message.mic === true;
          if (micEnabled && !nextMic) session.sendRealtimeInput({ audioStreamEnd: true });
          micEnabled = nextMic;
          cameraEnabled = message.camera === true;
        } else if (
          message.type === 'text' &&
          typeof message.text === 'string' &&
          message.text.trim() &&
          message.text.length <= 2000
        ) {
          session.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: message.text }] }],
            turnComplete: true,
          });
        }
      } catch {
        fail('The live connection was interrupted. Your camera and microphone have been released.');
      }
    });
  });
  return {
    close() {
      httpServer.off('upgrade', onUpgrade);
      for (const ws of [...active.values()]) ws.close(1001, 'Server is restarting.');
      for (const client of wss.clients) client.terminate();
      wss.close();
    },
    get activeCalls() {
      return active.size;
    },
  };
}
