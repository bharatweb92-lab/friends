# Yaari — Your people, always.

A responsive, WhatsApp-inspired AI-friend app with four fictional Indian companions. Built with React, TypeScript, Vite, Express, Google's Gemini SDK, and a same-origin WebSocket proxy for Gemini Live. The interface is original and is not affiliated with WhatsApp or Meta.

## Run locally

Requires Node.js 22.18+ and npm.

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. The development server binds to `0.0.0.0` and supports the Arena preview host. Browser code uses relative `/api` URLs; it never needs a backend URL or a client-side API key.

## Meet the friends

| Friend | City      | Personality                                     | Live voice |
| ------ | --------- | ----------------------------------------------- | ---------- |
| Aarav  | Mumbai    | Easygoing chai-and-life conversations           | Puck       |
| Ananya | Bengaluru | Gentle reflection and mindful moments           | Kore       |
| Kabir  | Delhi     | Encouragement, banter, and practical motivation | Charon     |
| Meera  | Jaipur    | Creativity, music, and little everyday joys     | Leda       |

The initial conversations are explicitly labeled samples. New replies are labeled **Demo replies** or **Live AI** below the composer.

## App sections

- **Home** — greeting, quick video call, friend cards, recent conversations, and Gemini connection status.
- **Chats** — the familiar desktop three-column / mobile list-to-chat messaging workspace.
- **Calls** — voice/video call launchers, call history, optional saved transcripts, and camera-sharing explanation.
- **Settings** — Gemini key connection, local camera/mic test, profile name, appearance, message sound, transcript preference, privacy notes, and data reset controls.

## Demo mode: no key needed

Without a key, the server returns clearly labeled, handcrafted, context-aware demo replies. Each friend has a distinct tone. This is a working interface preview, **not an actual language model**. Free-form intelligence and Hindi/Hinglish generation require a connected live provider. Live voice/video calls are disabled until Gemini is connected.

## Connect Gemini

The recommended path is **Settings → Gemini connection → paste your key → Connect Gemini**. Do not paste a real key into chat or commit it to the repository.

Alternatively, copy `.env.example` to `.env` and set server-only values:

```dotenv
GEMINI_API_KEY=your-gemini-key
GEMINI_CHAT_MODEL=gemini-flash-latest
GEMINI_LIVE_MODEL=gemini-3.8-live
PORT=3000
```

Restart the server after changing `.env`. `GOOGLE_API_KEY` is also accepted. Never prefix secrets with `VITE_`.

### How key sessions work

- A key submitted from Settings is validated server-side and kept **only in server process memory**.
- The browser receives a random, opaque session token stored in `sessionStorage`; the key itself is not stored in browser storage or returned by the API.
- Sessions expire after 8 hours, are removed on disconnect or server restart, and are capped per process.
- Disconnecting revokes the session and stops any active call using it.
- Chat sends the persona prompt, preferred display name, up to 24 recent non-sample messages, and the latest supported photo to Gemini.
- Google's retention, billing, and privacy terms apply. Set provider spend limits before regular use.

Connecting a key validates the chat model endpoint. Voice/video calling additionally requires that the key/project have access to the configured Gemini Live model and quota.

### Troubleshooting: “web page instead of JSON” / HTTP 404, 405, 502, 503, 504

Settings expects the Yaari **Node API** to answer `/api/gemini/connect` with JSON. If a static host, SPA fallback, or preview proxy returns an HTML error page instead, the app now shows an actionable message rather than a raw `JSON.parse` error, and the typed key stays in the form so you can retry.

- **HTTP 404/405 or “web page instead of JSON”** usually means only the frontend was deployed. Run `npm run dev` locally, or deploy the full Node server (`npm run build && npm start`) so `/api` and `/api/live` are served by Yaari.
- **HTTP 502/503/504** usually means the preview proxy or server could not complete the request. Check that the Node process is running and reachable.
- **“Couldn’t reach Gemini”** means the Yaari server itself cannot make outbound HTTPS requests to `generativelanguage.googleapis.com`. Restricted sandboxes may block this even when the UI loads correctly; use a local machine or a host with outbound Gemini access.
- A key is only marked connected after the server validates it and returns a valid opaque session token.

### Models

Defaults are configured in `server/prompts.mjs` and can be overridden with `GEMINI_CHAT_MODEL` and `GEMINI_LIVE_MODEL`:

- Chat: `gemini-flash-latest`
- Live: `gemini-3.8-live`

Model availability changes over time. If Gemini rejects a model, check Google AI Studio / the current Gemini model list and update the environment variable rather than hard-coding a new value in the client.

### Legacy text-only fallback

If no Gemini key is configured, the server can still use an OpenAI-compatible Chat Completions provider:

```dotenv
AI_API_KEY=your-provider-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4.1-mini
```

`OPENAI_API_KEY` is also accepted. `AI_BASE_URL` must use HTTPS except for localhost development. This fallback is text-only: it receives message text and attachment descriptions, not photo/file/audio contents, and it does not enable live calls. Gemini takes precedence when configured.

## Voice and video calls

Calls use **Gemini Live through the app server**, not a fake ringing screen:

1. The user explicitly starts a call and grants microphone/camera permission.
2. The browser opens a same-origin WebSocket to `/api/live` and sends the opaque session token.
3. The server opens a Gemini Live session with the selected friend's persona and voice.
4. Microphone audio is captured as mono PCM16 at 16 kHz through an AudioWorklet.
5. When camera sharing is on, the browser sends roughly one JPEG frame per second, scaled to at most 640 px wide.
6. Gemini audio is played back at 24 kHz; input/output captions and interruption events are shown in the call UI.

The friend is an **AI voice with an illustrated avatar**, not a human video feed. The user's own camera preview is shown while sharing. Controls include microphone mute, friend-audio mute, camera on/off, front/rear switch, captions, and hang-up. Calls have a 15-minute safety limit.

### Call privacy and cleanup

- No device access is requested until the user starts a connected call or runs the local device test.
- Active microphone/camera sharing is labeled in the call screen.
- Muting stops microphone sharing; turning off the camera releases the video track.
- Hang-up, closing the call screen, unmounting, disconnecting Gemini, and page unload stop media tracks and close the upstream session.
- Yaari does **not** record call audio or video.
- Live captions are visible during the call. Call transcripts are saved locally **only** if “Save call transcripts on this device” is enabled; this is off by default.
- The local Settings camera/mic test is never sent to Gemini.
- Use headphones where possible to reduce echo/self-interruption.

## Features

- Four illustrated personas with independent, persistent conversations and typing indicators
- Home / Chats / Calls / Settings navigation with desktop rail and mobile bottom navigation
- Friend/message search, in-conversation search, favourites, reactions, emoji, and quick starters
- Local photo/document attachments with previews and downloads; Gemini photo understanding when connected
- Microphone voice notes with cancel, one-minute limit, and audio playback
- Browser text-to-speech for chat replies, when supported
- Gemini Live voice/video calls with camera sharing, captions, mute controls, and call history
- Light/dark themes, optional notification sound, profile name, and mirror-camera preference
- Text exports, individual chat clearing, call-history clearing, and full conversation reset
- Accessible dialog focus management, keyboard sending, reduced-motion support, and visible action labels
- Explicit AI identity, demo-mode disclosure, privacy notes, and crisis-support information

**Not included:** human-to-human messaging, PSTN/phone-network calling, cloud accounts, cross-device sync, end-to-end encryption, professional advice, or server-side message history.

## Storage and privacy

Chats, attachments, settings, and call history use `localStorage` under `yaari.chats.v1`. The latest 100 messages per friend and 50 call records are retained. Clearing browser data removes them; there is no account recovery. Browser storage is not encrypted and is readable by anyone with access to the same browser profile. The app reports storage failures rather than claiming messages were saved. Export messages before clearing them. Exported text does not include binary attachments; save those separately from their previews.

The Gemini session token uses `sessionStorage` under `yaari.gemini.session`. It is not the API key.

These characters are fictional AI companions, not real people, therapists, or emergency services. For immediate danger in India, call **112**; for mental health support, call **TELE-MANAS 14416**.

## Production

```bash
npm run build
npm start
```

Express serves the compiled `dist/` app, `/api`, and the `/api/live` WebSocket upgrade on the same origin, default port 3000. It binds to `0.0.0.0`.

Deployment requirements:

- **HTTPS** for microphone/camera access in normal browsers; the browser then uses `wss:` automatically.
- A host that supports long-lived Node.js processes and WebSocket upgrades. A purely static host or short-lived serverless function is not sufficient for the Live proxy.
- A reverse proxy that forwards `Upgrade`/`Connection` headers and does not buffer or prematurely close `/api/live`.
- Server-only environment variables or the in-app Settings key flow. Do not commit `.env`.
- Provider spend limits, production authentication, durable rate limiting, abuse monitoring, and operational logging before exposing a shared deployment publicly.

The included per-instance rate limits and input bounds are development safeguards. Key sessions are process-local; restarting or scaling to multiple independent processes requires reconnecting or adding a shared, secure session layer. The app does not send blocking frame headers, so it can run in Arena's preview iframe.

## Checks

```bash
npm run typecheck
npm test
npm run build
# With the development server running:
npm run test:browser
```

The API/unit tests cover personas, validation, request limits, rate limiting, credential expiry/revocation, Gemini key connection/disconnection, mocked Gemini chat/photo forwarding, safe provider errors, and a fake-upstream Live WebSocket proxy (auth, media forwarding, mute, transcripts, interruption, disconnect, and connect/setup ordering).

The browser smoke test covers desktop/mobile layouts, sending, persistence, search, favourites, appearance, emoji, image attachments, voice recording/cancel/send, failed-request retry, export, clearing, navigation, the Gemini key form, mocked Gemini photo chat, and a **mocked Gemini Live transport** using real browser fake camera/microphone devices: PCM capture, JPEG frames, playback/captions, mic/speaker mute, camera on/off/switch, hang-up/unmount track cleanup, permission denial, call history, and saved transcripts. It uses a bundled headless Chromium; set `TEST_BROWSER_PATH` to use an existing Chromium binary, or `TEST_URL` to test another server. Screenshots are written to ignored `artifacts/`.

**Verification caveat:** automated checks use mocked Gemini REST/Live responses and fake media devices. They do not prove that a particular real API key, project quota, billing account, or Live model deployment works. No real Gemini key was used in this workspace.

## Project structure

- `src/` — React UI, local state, call media engine, and styles
- `data/friends.json` — shared persona metadata and starter conversations
- `server/api.mjs` — validated same-origin REST API, Gemini key sessions, chat adapter, and legacy fallback
- `server/credentials.mjs` — in-memory opaque key sessions and revocation
- `server/live.mjs` — authenticated `/api/live` WebSocket proxy to Gemini Live
- `server/prompts.mjs` — chat/call personas, model defaults, and voice mapping
- `server/demo.mjs` — transparent offline demo replies
- `server/index.mjs` — production static/API/WebSocket server
- `public/pcm-capture.js` — 16 kHz PCM16 AudioWorklet
- `public/avatars/` — generated, optimized illustrations
- `tests/` — API/unit and browser checks
