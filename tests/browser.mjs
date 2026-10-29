import { chromium as playwright } from '@playwright/test';
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
await page.context().grantPermissions(['microphone'], { origin: new URL(base).origin });
try {
  await page.goto(base);
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
  await page.getByRole('button', { name: 'Your preferences', exact: true }).click();
  await page.getByLabel('WHAT SHOULD WE CALL YOU?').fill('Rohan');
  await page.getByRole('button', { name: 'After hours', exact: true }).click();
  await page.getByRole('button', { name: 'Save my preferences' }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.screenshot({ path: 'artifacts/yaari-dark.png', fullPage: true });
  await page.reload();
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
  await page.getByRole('button', { name: 'Voice and video calls', exact: true }).click();
  await page.getByText('Less ringing. More sharing.').waitFor();
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
  await mobile.getByRole('heading', { name: 'A little more connected.' }).waitFor();
  await mobile.evaluate(() => document.fonts.ready);
  await mobile.screenshot({ path: 'artifacts/yaari-mobile-friends.png', fullPage: true });
  await mobile.getByRole('button', { name: 'Chat with Aarav', exact: false }).click();
  await mobile.getByRole('textbox', { name: 'Message Aarav', exact: true }).waitFor();
  await mobile.screenshot({ path: 'artifacts/yaari-mobile-chat.png', fullPage: true });
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await mobile.getByRole('button', { name: 'Back to conversations' }).click();
  await mobile.getByRole('heading', { name: 'A little more connected.' }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: desktop, mobile, four friends, chat replies, favourites, search, theme, persistence, emoji, image attachments, voice recording/cancel/send, failed-request retry, export, clear, new chat, call information, and no browser errors.',
  );
} finally {
  await browser.close();
}
