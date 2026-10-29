import { chromium as playwright, expect } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { brotliDecompressSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

await mkdir('artifacts', { recursive: true });
const executablePath = process.env.TEST_BROWSER_PATH || (await chromium.executablePath());
const launchOptions = {
  executablePath,
  args: [
    ...chromium.args.filter((arg) => arg !== '--single-process'),
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
  ],
  headless: true,
};
if (!process.env.TEST_BROWSER_PATH && process.platform === 'linux') {
  const libDir = join(tmpdir(), 'yaari-browser-libs');
  const archive = join(tmpdir(), 'yaari-browser-libs.tar');
  await mkdir(libDir, { recursive: true });
  await writeFile(
    archive,
    brotliDecompressSync(
      await import('node:fs/promises').then((fs) =>
        fs.readFile('node_modules/@sparticuz/chromium/bin/al2023.tar.br'),
      ),
    ),
  );
  execFileSync('tar', ['-xf', archive, '-C', libDir]);
  launchOptions.env = {
    ...process.env,
    LD_LIBRARY_PATH: `${libDir}/lib:${process.env.LD_LIBRARY_PATH || ''}`,
  };
}
const browser = await playwright.launch(launchOptions);
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const base = process.env.TEST_URL || 'http://127.0.0.1:3000';
await page.context().grantPermissions(['microphone', 'camera'], { origin: new URL(base).origin });
try {
  await page.goto(base);
  await page.getByRole('heading', { name: 'It’s a good day for a little hello.' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'artifacts/yaari-home.png', fullPage: true });
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Chats', exact: true })
    .click();
  await page.getByRole('heading', { name: 'A little more connected.' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'artifacts/yaari-desktop.png', fullPage: true });
  assert.equal(await page.locator('.friend-row').count(), 4);
  await page
    .getByRole('textbox', { name: 'Message Aarav', exact: true })
    .fill('Chai and a catch-up sounds lovely!');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page
    .locator('.messages')
    .getByText('Chai and a catch-up sounds lovely!', { exact: true })
    .waitFor();
  await page.locator('.typing-row').waitFor({ state: 'hidden', timeout: 10000 });
  assert.ok((await page.locator('.message-row.incoming').count()) >= 3);
  await page.getByRole('button', { name: 'Chat with Ananya', exact: false }).click();
  await page
    .getByRole('textbox', { name: 'Message Ananya', exact: true })
    .fill('Help me slow down');
  await page.getByRole('textbox', { name: 'Message Ananya', exact: true }).press('Enter');
  await page.locator('.typing-row').waitFor({ state: 'hidden', timeout: 10000 });
  assert.match(await page.locator('.messages').innerText(), /breath|slow|smaller/i);
  await page.getByRole('button', { name: 'Favourite', exact: true }).click();
  assert.equal(
    await page
      .getByRole('button', { name: 'Add favourite', exact: true })
      .getAttribute('aria-pressed'),
    'false',
  );
  await page.getByRole('button', { name: 'Add favourite', exact: true }).click();
  assert.equal(
    await page.getByRole('button', { name: 'Favourite', exact: true }).getAttribute('aria-pressed'),
    'true',
  );
  await page.getByRole('textbox', { name: 'Search friends or messages' }).fill('Kabir');
  assert.equal(await page.locator('.friend-row').count(), 1);
  await page.getByRole('button', { name: 'Chat with Kabir', exact: false }).click();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await page.getByRole('button', { name: 'Search this conversation', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search in this conversation' }).fill('next step');
  await page.locator('.message-text mark').first().waitFor();
  await page.getByRole('button', { name: 'Close conversation search' }).click();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  await page.locator('#profile-name').fill('Rohan');
  await page.getByRole('button', { name: 'After hours', exact: true }).click();
  await page.getByRole('button', { name: 'Save preferences' }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.screenshot({ path: 'artifacts/yaari-dark.png', fullPage: true });
  await page.reload();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Chats', exact: true })
    .click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  assert.match(await page.locator('.user-profile').innerText(), /Rohan/);
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.getByRole('button', { name: 'Chat with Aarav', exact: false }).click();
  await page
    .locator('.messages')
    .getByText('Chai and a catch-up sounds lovely!', { exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Choose an emoji' }).click();
  await page.getByRole('button', { name: 'Insert ☕', exact: true }).click();
  assert.equal(
    await page.getByRole('textbox', { name: 'Message Aarav', exact: true }).inputValue(),
    '☕',
  );
  await page.getByRole('textbox', { name: 'Message Aarav', exact: true }).fill('');
  await page.getByRole('button', { name: 'Choose an emoji' }).click();
  await page.locator('input[aria-label="Upload a photo"]').setInputFiles({
    name: 'little-moment.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await page.locator('.attachment-preview').waitFor();
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.locator('.typing-row').waitFor({ state: 'hidden', timeout: 10000 });
  await page.getByRole('button', { name: 'Open photo little-moment.png' }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  // Record, cancel, then record and send a real MediaRecorder blob using a test microphone.
  await page.getByRole('button', { name: 'Record a voice note', exact: true }).click();
  await page.locator('.recording-status').waitFor();
  await page.getByRole('button', { name: 'Cancel recording', exact: true }).click();
  await page.locator('.recording-status').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.attachment-preview').count(), 0);
  await page.getByRole('button', { name: 'Record a voice note', exact: true }).click();
  await page.locator('.recording-status').waitFor();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Finish voice note', exact: true }).click();
  await page.locator('.attachment-preview audio, .attachment-preview strong').first().waitFor();
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.locator('.typing-row').waitFor({ state: 'hidden', timeout: 10000 });
  await page.locator('.voice-note audio').waitFor();
  assert.ok(
    await page
      .locator('.voice-note audio')
      .evaluate((audio) => audio.src.startsWith('data:audio/')),
  );
  // Failed responses preserve the user's message and offer a working retry.
  await page.route('**/api/chat', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'A test connection interruption.' }),
    }),
  );
  await page
    .getByRole('textbox', { name: 'Message Aarav', exact: true })
    .fill('A little test message');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert.match(await page.locator('.messages').innerText(), /A little test message/);
  await page.unroute('**/api/chat');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.locator('.typing-row').waitFor({ state: 'hidden', timeout: 10000 });
  assert.equal(await page.locator('.chat-error').count(), 0);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save this conversation', exact: true }).click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /yaari-aarav/);
  await page.getByRole('button', { name: 'Clear conversation', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Clear conversation', exact: true })
    .click();
  assert.equal(await page.locator('.message-row').count(), 0);
  await page.getByRole('button', { name: 'Start a new chat' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Meera/ }).click();
  await page.getByRole('textbox', { name: 'Message Meera', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Voice call Meera', exact: true }).click();
  await page.getByText('Connect your Gemini API key first.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  // Mobile: start at the friends list, then open and leave a conversation.
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  mobile.on('pageerror', (error) => errors.push(error.message));
  await mobile.goto(base);
  await mobile
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('button', { name: 'Chats', exact: true })
    .click();
  await mobile.getByRole('heading', { name: 'A little more connected.' }).waitFor();
  await mobile.evaluate(() => document.fonts.ready);
  await mobile.screenshot({ path: 'artifacts/yaari-mobile-friends.png', fullPage: true });
  await mobile.getByRole('button', { name: 'Chat with Aarav', exact: false }).click();
  await mobile.getByRole('textbox', { name: 'Message Aarav', exact: true }).waitFor();
  await mobile.screenshot({ path: 'artifacts/yaari-mobile-chat.png', fullPage: true });
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await mobile.getByRole('button', { name: 'Back to conversations' }).click();
  await mobile.getByRole('heading', { name: 'A little more connected.' }).waitFor();
  // A separate, explicitly mocked Gemini transport tests real browser media APIs
  // without pretending that a paid external Gemini session was exercised.
  const callPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  callPage.on('pageerror', (error) => errors.push(error.message));
  await callPage
    .context()
    .grantPermissions(['microphone', 'camera'], { origin: new URL(base).origin });
  let mockConnected = false;
  const mockToken = 't'.repeat(43);
  const mockKey = 'browser-test-key-not-a-real-credential';
  const mockStatus = () => ({
    mode: mockConnected ? 'live' : 'demo',
    provider: mockConnected ? 'gemini' : 'demo',
    geminiConnected: mockConnected,
    liveAvailable: mockConnected,
    source: mockConnected ? 'session' : 'none',
    chatModel: 'mock-chat',
    liveModel: 'mock-live',
    expiresAt: Date.now() + 3600000,
  });
  await callPage.route('**/api/status', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(mockStatus()) }),
  );
  await callPage.route('**/api/gemini/connect', async (route) => {
    assert.equal(route.request().postDataJSON().apiKey, mockKey);
    mockConnected = true;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ...mockStatus(), token: mockToken }),
    });
  });
  await callPage.route('**/api/gemini/disconnect', async (route) => {
    assert.equal(route.request().headers().authorization, `Bearer ${mockToken}`);
    mockConnected = false;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(mockStatus()) });
  });
  const media = { audio: 0, video: 0, states: [] };
  let mockSocket;
  await callPage.routeWebSocket('**/api/live', (socket) => {
    mockSocket = socket;
    socket.onMessage((raw) => {
      const message = JSON.parse(String(raw));
      if (message.type === 'start') {
        assert.equal(message.token, mockToken);
        socket.send(JSON.stringify({ type: 'ready' }));
        socket.send(
          JSON.stringify({
            type: 'transcript',
            role: 'assistant',
            text: 'Mock Gemini: hello from the transport test.',
          }),
        );
        const pcm = Buffer.alloc(24000);
        for (let i = 0; i < 12000; i++)
          pcm.writeInt16LE(Math.round(Math.sin(i / 12) * 1200), i * 2);
        socket.send(
          JSON.stringify({ type: 'audio', data: pcm.toString('base64'), sampleRate: 24000 }),
        );
      } else if (message.type === 'audio') media.audio++;
      else if (message.type === 'video') media.video++;
      else if (message.type === 'mediaState') media.states.push(message);
    });
  });
  await callPage.addInitScript(() => {
    window.__testTracks = [];
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.__originalGetMedia = original;
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      window.__testTracks.push(...stream.getTracks());
      return stream;
    };
    window.__trackedGetMedia = navigator.mediaDevices.getUserMedia;
  });
  await callPage.goto(base);
  await callPage
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Settings', exact: true })
    .click();
  await callPage.locator('#gemini-key').fill(mockKey);
  await callPage.getByRole('button', { name: 'Show API key', exact: true }).click();
  assert.equal(await callPage.locator('#gemini-key').getAttribute('type'), 'text');
  await callPage.getByRole('button', { name: 'Hide API key', exact: true }).click();
  // A proxy/static host can return HTML instead of JSON. The UI must explain that
  // clearly, keep the typed key for retry, and never store a bogus session.
  await callPage.route(
    '**/api/gemini/connect',
    (route) =>
      route.fulfill({
        status: 502,
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><html><body>Bad Gateway</body></html>',
      }),
    { times: 1 },
  );
  await callPage.getByRole('button', { name: 'Connect Gemini', exact: true }).click();
  await callPage
    .getByRole('alert')
    .filter({
      hasText: 'The app server or preview proxy could not complete the request (HTTP 502)',
    })
    .waitFor();
  assert.equal(await callPage.locator('#gemini-key').inputValue(), mockKey);
  assert.equal(await callPage.evaluate(() => sessionStorage.getItem('yaari.gemini.session')), null);
  await callPage.getByRole('button', { name: 'Connect Gemini', exact: true }).click();
  await callPage.getByRole('button', { name: 'Disconnect & remove key' }).waitFor();
  assert.equal(
    await callPage.evaluate(() => sessionStorage.getItem('yaari.gemini.session')),
    mockToken,
  );
  assert.ok(
    await callPage.evaluate(
      (key) =>
        !JSON.stringify({ ...localStorage }).includes(key) &&
        !JSON.stringify({ ...sessionStorage }).includes(key),
      mockKey,
    ),
  );
  await callPage.locator('#profile-name').fill('Rohan');
  await callPage.getByRole('switch', { name: 'Save call transcripts on this device' }).click();
  await callPage.getByRole('button', { name: 'Save preferences' }).click();
  await callPage.locator('.settings-page').evaluate((el) => el.scrollTo({ top: 0 }));
  await callPage.screenshot({ path: 'artifacts/yaari-settings.png', fullPage: true });
  // Permission denial is actionable and never leaves a device running.
  await callPage.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Test denial', 'NotAllowedError');
    };
  });
  await callPage.getByRole('button', { name: 'Test my camera & mic' }).click();
  await callPage.getByRole('alert').filter({ hasText: 'Permission was denied' }).waitFor();
  await callPage.evaluate(() => {
    navigator.mediaDevices.getUserMedia = window.__trackedGetMedia;
  });
  await callPage.getByRole('button', { name: 'Test my camera & mic' }).click();
  await callPage.locator('.device-test video').waitFor();
  await callPage.getByRole('button', { name: 'Stop camera & microphone' }).click();
  assert.ok(
    await callPage.evaluate(() => window.__testTracks.every((t) => t.readyState === 'ended')),
  );
  // The Gemini chat UI forwards the opaque session and the actual latest photo.
  let geminiRequest;
  await callPage.route('**/api/chat', async (route) => {
    geminiRequest = {
      body: route.request().postDataJSON(),
      authorization: route.request().headers().authorization,
    };
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        reply: 'Mock Gemini received your photo.',
        mode: 'live',
        provider: 'gemini',
      }),
    });
  });
  await callPage
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Chats', exact: true })
    .click();
  await callPage.locator('input[aria-label="Upload a photo"]').setInputFiles({
    name: 'camera-test.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await callPage
    .getByRole('textbox', { name: 'Message Aarav', exact: true })
    .fill('Look at this little moment');
  await callPage.getByRole('button', { name: 'Send message', exact: true }).click();
  await callPage
    .getByRole('log', { name: 'Chat messages' })
    .getByText('Mock Gemini received your photo.', { exact: true })
    .waitFor();
  assert.equal(geminiRequest.authorization, `Bearer ${mockToken}`);
  assert.equal(geminiRequest.body.messages.at(-1).image.mime, 'image/webp');
  assert.ok(geminiRequest.body.messages.at(-1).image.data.length > 0);
  await callPage
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('button', { name: 'Calls', exact: true })
    .click();
  await callPage.screenshot({ path: 'artifacts/yaari-calls.png', fullPage: true });
  await callPage.getByRole('button', { name: 'Video call Aarav', exact: true }).click();
  await callPage.getByRole('button', { name: 'Allow devices & start call' }).click();
  await callPage.locator('.call-connected-label').waitFor();
  await callPage.waitForFunction(
    () => document.querySelector('.call-local-camera video')?.readyState >= 2,
  );
  await expect.poll(() => media.audio, { timeout: 10000 }).toBeGreaterThan(0);
  await expect
    .poll(() => media.video, { timeout: 30000, intervals: [500, 1000, 2000] })
    .toBeGreaterThan(0);
  await callPage
    .locator('.live-transcript')
    .getByText('Mock Gemini: hello from the transport test.')
    .waitFor();
  await callPage.getByRole('button', { name: 'Mute friend audio', exact: true }).click();
  await callPage.getByRole('button', { name: 'Unmute friend audio', exact: true }).click();
  mockSocket.send(JSON.stringify({ type: 'interrupted' }));
  await callPage.locator('.call-avatar-halo.speaking').waitFor({ state: 'hidden' });
  await callPage.screenshot({ path: 'artifacts/yaari-live-call-mocked.png', fullPage: true });
  await callPage.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await callPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  );
  await callPage.screenshot({ path: 'artifacts/yaari-mobile-call-mocked.png', fullPage: true });
  await callPage.setViewportSize({ width: 1280, height: 900 });
  await callPage.getByRole('button', { name: 'Mute microphone', exact: true }).click();
  await callPage.getByRole('button', { name: 'Unmute microphone', exact: true }).click();
  const facingBeforeSwitch = await callPage
    .locator('.call-local-camera')
    .getAttribute('data-facing');
  await callPage.getByRole('button', { name: 'Switch front and rear camera', exact: true }).click();
  await expect
    .poll(() => callPage.locator('.call-local-camera').getAttribute('data-facing'))
    .not.toBe(facingBeforeSwitch);
  await expect
    .poll(() =>
      callPage.evaluate(
        () => window.__testTracks.filter((t) => t.kind === 'video').at(-1)?.readyState,
      ),
    )
    .toBe('live');
  assert.ok(
    await callPage.evaluate(() =>
      window.__testTracks
        .filter((t) => t.kind === 'video')
        .slice(0, -1)
        .every((t) => t.readyState === 'ended'),
    ),
  );
  await callPage.getByRole('button', { name: 'Turn camera off', exact: true }).click();
  await expect.poll(() => media.states.filter((state) => !state.camera).length).toBeGreaterThan(0);
  assert.ok(
    await callPage.evaluate(() =>
      window.__testTracks.filter((t) => t.kind === 'video').every((t) => t.readyState === 'ended'),
    ),
  );
  await callPage.getByRole('button', { name: 'Turn camera on', exact: true }).click();
  await callPage.getByRole('button', { name: 'Turn camera off', exact: true }).waitFor();
  await callPage.getByRole('button', { name: 'End call', exact: true }).click();
  await callPage.getByRole('button', { name: 'Back to Yaari', exact: true }).click();
  assert.ok(
    await callPage.evaluate(() => window.__testTracks.every((t) => t.readyState === 'ended')),
  );
  assert.equal(await callPage.locator('.call-history-list article').count(), 1);
  assert.match(await callPage.locator('.call-history-list').innerText(), /Video/);
  await callPage.locator('.saved-transcript summary').click();
  assert.match(await callPage.locator('.saved-transcript').innerText(), /Mock Gemini/);
  // Closing the call screen without pressing hang-up must also release devices.
  await callPage.getByRole('button', { name: 'Voice call Aarav', exact: true }).click();
  await callPage.getByRole('button', { name: 'Allow devices & start call' }).click();
  await callPage.locator('.call-connected-label').waitFor();
  await callPage.getByRole('button', { name: 'Close dialog', exact: true }).click();
  assert.ok(
    await callPage.evaluate(() => window.__testTracks.every((t) => t.readyState === 'ended')),
  );
  assert.equal(await callPage.locator('.call-history-list article').count(), 2);
  // A denied call produces a final error state and a failed history entry.
  await callPage.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Test denial', 'NotAllowedError');
    };
  });
  await callPage.getByRole('button', { name: 'Voice call Aarav', exact: true }).click();
  await callPage.getByRole('button', { name: 'Allow devices & start call' }).click();
  await callPage.getByRole('alert').filter({ hasText: 'Permission wasn’t granted' }).waitFor();
  await callPage.getByRole('button', { name: 'Close & check settings' }).click();
  await callPage.getByRole('heading', { name: 'Settings, made personal.' }).waitFor();
  await callPage.getByRole('button', { name: 'Disconnect & remove key' }).click();
  await callPage.locator('#gemini-key').waitFor();
  assert.equal(await callPage.evaluate(() => sessionStorage.getItem('yaari.gemini.session')), null);
  await callPage.evaluate(() => {
    navigator.mediaDevices.getUserMedia = window.__trackedGetMedia;
  });
  // Mobile Home keeps all four primary destinations reachable.
  await mobile
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('button', { name: 'Home', exact: true })
    .click();
  await mobile.screenshot({ path: 'artifacts/yaari-mobile-home.png', fullPage: true });
  assert.equal(await mobile.locator('.home-friend-card').count(), 4);
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await callPage.close();

  assert.deepEqual(errors, []);
  console.log(
    'PASS: desktop, mobile, four friends, chat replies, favourites, search, theme, persistence, emoji, image attachments, voice recording/cancel/send, failed-request retry, export, clear, new chat, call setup, mocked Gemini live audio/video transport, device cleanup, Gemini key form, mocked photo chat, call history/transcripts, permission denial, and no browser errors.',
  );
} finally {
  await browser.close();
}
