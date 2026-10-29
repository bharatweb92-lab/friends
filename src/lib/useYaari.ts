import { useCallback, useEffect, useRef, useState } from 'react';
import { initialState, loadState, STORAGE_KEY } from './store';
import { uid } from './utils';
import type {
  ApiStatus,
  Attachment,
  ChatState,
  FriendId,
  Message,
  Settings,
  CallRecord,
} from './types';
import { authHeaders } from './connection';
import { ApiError, readApiJson } from './apiResponse';

export function useYaari(apiStatus: ApiStatus, refreshStatus: () => Promise<void>) {
  const [state, setState] = useState<ChatState>(loadState);
  const [activeId, setActiveId] = useState<FriendId>('aarav');
  const [pending, setPending] = useState<Partial<Record<FriendId, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<FriendId, string>>>({});

  const [storageError, setStorageError] = useState(false);
  const activeRef = useRef(activeId);
  const stateRef = useRef(state);
  const pendingRef = useRef(new Set<FriendId>());
  activeRef.current = activeId;
  stateRef.current = state;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [state]);
  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
  }, [state.settings.theme]);

  const selectFriend = useCallback((id: FriendId) => {
    setActiveId(id);
    setState((s) => ({ ...s, unread: { ...s.unread, [id]: 0 } }));
  }, []);

  const requestReply = useCallback(
    async (id: FriendId) => {
      if (pendingRef.current.has(id)) return;
      pendingRef.current.add(id);
      setPending((p) => ({ ...p, [id]: true }));
      setErrors((e) => ({ ...e, [id]: '' }));
      const messages = stateRef.current.conversations[id]
        .filter((m) => !m.sample)
        .slice(-24)
        .map((m, index, recent) => ({
          role: m.role,
          text:
            m.text ||
            (m.attachment ? `[User attached ${m.attachment.kind}: ${m.attachment.name}.]` : ''),
          ...(m.role === 'user' &&
          index === recent.length - 1 &&
          m.attachment?.kind === 'image' &&
          ['image/jpeg', 'image/png', 'image/webp'].includes(
            m.attachment.dataUrl.slice(5, m.attachment.dataUrl.indexOf(';')),
          )
            ? {
                image: {
                  mime: m.attachment.dataUrl.slice(5, m.attachment.dataUrl.indexOf(';')),
                  data: m.attachment.dataUrl.split(',')[1],
                },
              }
            : {}),
        }));
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...authHeaders(),
          },
          body: JSON.stringify({
            friendId: id,
            messages,
            userName: stateRef.current.settings.name,
          }),
          signal: AbortSignal.timeout(45_000),
        });
        const data = await readApiJson<{ reply?: unknown }>(
          response,
          'Your friend couldn’t reply because the app server returned an unexpected response. Please try again.',
        );
        void refreshStatus();
        if (typeof data.reply !== 'string')
          throw new ApiError(
            'Your friend couldn’t reply because the app server returned an invalid response. Please try again.',
            response.status,
          );
        const reply: Message = {
          id: uid(),
          role: 'assistant',
          text: data.reply,
          createdAt: Date.now(),
        };
        setState((s) => ({
          ...s,
          conversations: {
            ...s.conversations,
            [id]: [
              ...s.conversations[id].map((m) =>
                m.role === 'user' ? { ...m, status: 'read' as const } : m,
              ),
              reply,
            ].slice(-100),
          },
          unread: { ...s.unread, [id]: activeRef.current === id ? 0 : s.unread[id] + 1 },
        }));
        if (
          stateRef.current.settings.sound &&
          !stateRef.current.muted.includes(id) &&
          activeRef.current === id
        ) {
          try {
            const audio = new AudioContext();
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.connect(gain);
            gain.connect(audio.destination);
            oscillator.frequency.value = 680;
            gain.gain.setValueAtTime(0.035, audio.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.15);
            oscillator.start();
            oscillator.stop(audio.currentTime + 0.15);
            oscillator.onended = () => {
              void audio.close();
            };
          } catch {
            /* Sound is optional. */
          }
        }
      } catch (error) {
        setErrors((e) => ({
          ...e,
          [id]:
            error instanceof ApiError
              ? error.message
              : error instanceof Error && error.name === 'TimeoutError'
                ? 'The connection took too long. Your message is saved — try again.'
                : error instanceof Error && error.name !== 'TypeError'
                  ? error.message
                  : 'Could not reach the app server. Your message is saved — check the server and try again.',
        }));
      } finally {
        pendingRef.current.delete(id);
        setPending((p) => ({ ...p, [id]: false }));
      }
    },
    [refreshStatus],
  );

  const sendMessage = useCallback(
    (text: string, attachment?: Attachment) => {
      const id = activeRef.current;
      const content = text.trim().slice(0, 4000);
      if ((!content && !attachment) || pendingRef.current.has(id)) return false;
      const message: Message = {
        id: uid(),
        role: 'user',
        text: content,
        createdAt: Date.now(),
        status: 'sent',
        ...(attachment ? { attachment } : {}),
      };
      setState((s) => ({
        ...s,
        conversations: { ...s.conversations, [id]: [...s.conversations[id], message].slice(-100) },
      }));
      stateRef.current = {
        ...stateRef.current,
        conversations: {
          ...stateRef.current.conversations,
          [id]: [...stateRef.current.conversations[id], message].slice(-100),
        },
      };
      void requestReply(id);
      return true;
    },
    [requestReply],
  );

  const toggleFavorite = useCallback(
    (id: FriendId) =>
      setState((s) => ({
        ...s,
        favorites: s.favorites.includes(id)
          ? s.favorites.filter((f) => f !== id)
          : [...s.favorites, id],
      })),
    [],
  );
  const toggleMute = useCallback(
    (id: FriendId) =>
      setState((s) => ({
        ...s,
        muted: s.muted.includes(id) ? s.muted.filter((f) => f !== id) : [...s.muted, id],
      })),
    [],
  );
  const updateSettings = useCallback(
    (settings: Partial<Settings>) =>
      setState((s) => ({ ...s, settings: { ...s.settings, ...settings } })),
    [],
  );
  const reactToMessage = useCallback(
    (id: FriendId, messageId: string, reaction: string) =>
      setState((s) => ({
        ...s,
        conversations: {
          ...s.conversations,
          [id]: s.conversations[id].map((m) =>
            m.id === messageId
              ? { ...m, reaction: m.reaction === reaction ? undefined : reaction }
              : m,
          ),
        },
      })),
    [],
  );
  const clearChat = useCallback((id: FriendId) => {
    if (pendingRef.current.has(id)) return false;
    setState((s) => ({
      ...s,
      conversations: { ...s.conversations, [id]: [] },
      unread: { ...s.unread, [id]: 0 },
    }));
    setErrors((e) => ({ ...e, [id]: '' }));
    return true;
  }, []);
  const resetAll = useCallback(() => {
    if (pendingRef.current.size) return false;
    const fresh = initialState();
    setState((s) => ({ ...fresh, settings: s.settings }));
    setErrors({});
    return true;
  }, []);

  const addCall = useCallback((call: CallRecord) => {
    setState((s) => ({ ...s, calls: [call, ...s.calls].slice(0, 50) }));
  }, []);
  const clearCalls = useCallback(() => setState((s) => ({ ...s, calls: [] })), []);

  return {
    addCall,
    clearCalls,
    state,
    activeId,
    selectFriend,
    pending,
    errors,
    sendMessage,
    retry: requestReply,
    toggleFavorite,
    toggleMute,
    updateSettings,
    reactToMessage,
    clearChat,
    resetAll,
    apiStatus,
    storageError,
  };
}
