import type { FriendId, Message } from './types';

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const formatTime = (time: number) =>
  new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    .format(time)
    .toLowerCase();
export const shortTime = (time: number) =>
  new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
    .format(time)
    .replace(/\s?(am|pm)/i, '')
    .toLowerCase();
export const formatSize = (size: number) =>
  size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`;
export const messagePreview = (message?: Message) =>
  !message
    ? 'Say hello. A good conversation starts here.'
    : message.text ||
      (message.attachment?.kind === 'audio'
        ? '🎙️ Voice note'
        : message.attachment?.kind === 'image'
          ? '📷 Photo'
          : `📎 ${message.attachment?.name ?? 'Attachment'}`);
export const isFriendId = (value: unknown): value is FriendId =>
  ['aarav', 'ananya', 'kabir', 'meera'].includes(value as string);

export function downloadFile(content: BlobPart, name: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
