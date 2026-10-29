import friendData from '../../data/friends.json';
import type { ChatState, Friend, Message, CallRecord } from './types';
import { isFriendId, uid } from './utils';

export const FRIENDS = friendData as Friend[];
export const STORAGE_KEY = 'yaari.chats.v1';

export function initialState(): ChatState {
  const now = Date.now();
  const conversations = {} as ChatState['conversations'];
  const unread = {} as ChatState['unread'];
  FRIENDS.forEach((friend, index) => {
    conversations[friend.id] = friend.seed.map((message, i) => ({
      ...message,
      id: uid(),
      createdAt: now - (index * 23 + 2) * 60_000 - (friend.seed.length - i) * 60_000,
      sample: true,
      ...(message.role === 'user' ? { status: 'read' as const } : {}),
    }));
    unread[friend.id] = friend.unread;
  });
  return {
    version: 1,
    conversations,
    unread,
    favorites: ['ananya'],
    muted: [],
    settings: {
      name: 'You',
      theme: 'light',
      sound: false,
      saveTranscripts: false,
      mirrorCamera: true,
    },
    calls: [],
  };
}

function validMessage(value: unknown): value is Message {
  if (!value || typeof value !== 'object') return false;
  const m = value as Message;
  if (
    typeof m.id !== 'string' ||
    !['user', 'assistant'].includes(m.role) ||
    typeof m.text !== 'string' ||
    !Number.isFinite(m.createdAt)
  )
    return false;
  if (m.attachment) {
    const a = m.attachment;
    if (
      !['image', 'audio', 'file'].includes(a.kind) ||
      typeof a.name !== 'string' ||
      typeof a.dataUrl !== 'string' ||
      !/^data:[\w.+-]+\/[\w.+-]+;base64,[A-Za-z0-9+/=]*$/.test(a.dataUrl)
    )
      return false;
  }
  return true;
}

export function loadState(): ChatState {
  const fallback = initialState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as ChatState;
    if (saved.version !== 1 || !saved.conversations) return fallback;
    for (const friend of FRIENDS) {
      const messages = saved.conversations[friend.id];
      if (Array.isArray(messages) && messages.every(validMessage))
        fallback.conversations[friend.id] = messages.slice(-100);
      fallback.unread[friend.id] = Math.max(
        0,
        Math.min(99, Number(saved.unread?.[friend.id]) || 0),
      );
    }
    fallback.favorites = Array.isArray(saved.favorites) ? saved.favorites.filter(isFriendId) : [];
    fallback.muted = Array.isArray(saved.muted) ? saved.muted.filter(isFriendId) : [];
    fallback.settings = {
      name:
        typeof saved.settings?.name === 'string'
          ? saved.settings.name.slice(0, 40) || 'You'
          : 'You',
      theme: saved.settings?.theme === 'dark' ? 'dark' : 'light',
      sound: Boolean(saved.settings?.sound),
      saveTranscripts: Boolean(saved.settings?.saveTranscripts),
      mirrorCamera: saved.settings?.mirrorCamera !== false,
    };
    fallback.calls = Array.isArray(saved.calls)
      ? saved.calls
          .filter(
            (call: CallRecord) =>
              call &&
              typeof call.id === 'string' &&
              isFriendId(call.friendId) &&
              ['voice', 'video'].includes(call.mode) &&
              Number.isFinite(call.startedAt) &&
              Number.isFinite(call.duration) &&
              call.duration >= 0 &&
              ['completed', 'failed', 'cancelled'].includes(call.status),
          )
          .slice(0, 50)
          .map((call) => ({
            ...call,
            cameraUsed: Boolean(call.cameraUsed),
            ...(Array.isArray(call.transcript)
              ? {
                  transcript: call.transcript
                    .filter(
                      (line) =>
                        line &&
                        ['user', 'assistant'].includes(line.role) &&
                        typeof line.text === 'string',
                    )
                    .slice(0, 200)
                    .map((line) => ({ role: line.role, text: line.text.slice(0, 40_000) })),
                }
              : {}),
          }))
      : [];
    return fallback;
  } catch {
    return fallback;
  }
}
