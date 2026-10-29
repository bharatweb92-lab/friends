# Yaari — Your people, always.

A responsive, WhatsApp-inspired AI-friend chat app with four fictional Indian companions. Built with React, TypeScript, Vite, Express, and a small server-side AI adapter. The interface is original and is not affiliated with WhatsApp or Meta.

## Run locally

Requires Node.js 22.18+ and npm.

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. The development server binds to `0.0.0.0` and supports the Arena preview host. Its same-origin `/api` middleware means browser code never needs a backend URL or API key.

## Meet the friends

| Friend | City      | Personality                                     |
| ------ | --------- | ----------------------------------------------- |
| Aarav  | Mumbai    | Easygoing chai-and-life conversations           |
| Ananya | Bengaluru | Gentle reflection and mindful moments           |
| Kabir  | Delhi     | Encouragement, banter, and practical motivation |
| Meera  | Jaipur    | Creativity, music, and little everyday joys     |

The initial conversations are explicitly labeled samples. New replies are labeled **Demo replies** or **Live AI** below the composer.

## Demo mode: no key needed

Without a key, the server returns clearly labeled, handcrafted, context-aware demo replies. Each friend has a distinct tone. This is a working interface preview, **not an actual language model**. Free-form intelligence and Hindi/Hinglish generation require a connected live provider.

## Enable live AI

Copy `.env.example` to `.env` and set server-only values:

```dotenv
AI_API_KEY=your-provider-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4.1-mini
PORT=3000
```

Restart the server. The adapter uses the Chat Completions API and works with OpenAI-compatible providers. `OPENAI_API_KEY` is also accepted. `AI_BASE_URL` must use HTTPS except for localhost development. No provider call is made in demo mode.

- API keys are never included in the client bundle or returned by the API.
- Live mode sends the preferred display name, the persona prompt, and up to 24 recent messages to the configured provider. Sample conversations are excluded.
- Binary attachments and voice notes remain in the browser. The AI receives only a short attachment description, not file contents. The UI explains this limitation.
- The provider's own retention, billing, and privacy terms apply.
- For deployment, set environment variables in your hosting platform. Do not commit `.env`.
- The included per-instance rate limit and input bounds are development safeguards, not a substitute for production authentication, durable rate limiting, abuse monitoring, or provider spend limits.

## Features

- Four illustrated personas with individual conversations and typing indicators
- Familiar three-column desktop layout and list-to-chat mobile navigation
- Persistent browser-local messages, favourites, mute settings, display name, and theme
- Friend/message search, in-conversation search, and result navigation
- Emoji picker, quick conversation starters, reactions, and copy/read-aloud actions
- Local photo/document attachments with previews and downloads
- Microphone recording with cancel, one-minute limit, and audio playback
- Text-to-speech through the browser, when supported
- Light/dark themes and optional notification sound
- Text exports, individual chat clearing, and full conversation reset
- Accessible dialog focus management, keyboard sending, reduced-motion support, and visible action labels
- Explicit AI identity, demo-mode disclosure, privacy notes, and crisis-support information

**Not included:** real phone/video calling, human-to-human messaging, cloud accounts, cross-device sync, end-to-end encryption, file-content analysis, or professional advice. Call buttons explain these limits instead of pretending to connect. Muting controls the optional in-app notification sound.

## Storage and privacy

Chats and attachments use `localStorage` under `yaari.chats.v1`. The latest 100 messages per friend are retained. Clearing browser data removes them; there is no account recovery. Browser storage is not encrypted and is readable by anyone with access to the same browser profile. The app reports storage failures rather than claiming messages were saved. Export messages before clearing them. Exported text does not include binary attachments; save those separately from their previews.

These characters are fictional AI companions, not real people, therapists, or emergency services. For immediate danger in India, call **112**; for mental health support, call **TELE-MANAS 14416**.

## Production

```bash
npm run build
npm start
```

Express serves the compiled `dist/` app and `/api` on the same origin, default port 3000. It binds to `0.0.0.0`. Use HTTPS for microphone and clipboard access. The app does not send blocking frame headers, so it can run in Arena's preview iframe.

## Checks

```bash
npm run typecheck
npm test
npm run build
# With the development server running:
npm run test:browser
```

The API tests cover personas, validation, request limits, rate limiting, server-only live-provider configuration, and safe error handling. The browser smoke test covers desktop/mobile layouts, sending, persistence, search, favourites, appearance, emoji, image attachments, voice recording/cancel/send with a test microphone, failed-request retry, export, clearing, and navigation. It uses a bundled headless Chromium; set `TEST_BROWSER_PATH` to use an existing Chromium binary, or `TEST_URL` to test another server. Screenshots are written to ignored `artifacts/`.

## Project structure

- `src/` — React UI, local state, and styles
- `data/friends.json` — shared persona metadata and starter conversations
- `server/api.mjs` — validated same-origin API and optional AI-provider adapter
- `server/demo.mjs` — transparent offline demo replies
- `server/index.mjs` — production static server
- `public/avatars/` — generated, optimized illustrations
- `tests/` — API and browser checks
