import { ApiError, readApiJson } from './apiResponse';

type StreamEvent =
  | { type: 'start' }
  | { type: 'delta'; text: string }
  | { type: 'done'; reply: string }
  | { type: 'error'; error?: string; code?: string };

const interrupted = () =>
  new ApiError('The reply was interrupted. Your message is saved — please try again.', 502);

/** Read either the legacy JSON reply or the new newline-delimited stream. */
export async function readChatResponse(
  response: Response,
  onDelta: (textSoFar: string) => void,
): Promise<{ reply: string }> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/x-ndjson')) {
    const data = await readApiJson<{ reply?: unknown }>(
      response,
      'Your friend couldn’t reply because the app server returned an unexpected response. Please try again.',
    );
    if (typeof data.reply !== 'string')
      throw new ApiError(
        'Your friend couldn’t reply because the app server returned an invalid response. Please try again.',
        response.status,
      );
    return { reply: data.reply };
  }
  if (!response.ok) {
    await readApiJson(response);
    throw interrupted();
  }
  if (!response.body) throw interrupted();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let reply = '';
  let completed = false;
  const handleLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let event: StreamEvent;
    try {
      event = JSON.parse(trimmed) as StreamEvent;
    } catch {
      throw new ApiError('The app server sent an unreadable reply stream. Please try again.', 502);
    }
    if (event.type === 'delta' && typeof event.text === 'string') {
      reply = (reply + event.text).slice(0, 8000);
      onDelta(reply);
    } else if (event.type === 'done' && typeof event.reply === 'string') {
      reply = event.reply.slice(0, 8000);
      completed = true;
    } else if (event.type === 'error') {
      throw new ApiError(
        typeof event.error === 'string' && event.error.trim()
          ? event.error
          : 'Gemini could not complete the reply. Please try again.',
        502,
      );
    }
  };
  try {
    while (!completed) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline >= 0 && !completed) {
        handleLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
    if (!completed && buffer.trim()) handleLine(buffer);
    if (!completed) throw interrupted();
    return { reply };
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* Already closed. */
    }
    reader.releaseLock();
  }
}
