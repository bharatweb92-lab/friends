import { useCallback, useEffect, useState } from 'react';
import type { ApiStatus } from './types';
import { ApiError, readApiJson } from './apiResponse';

const SESSION_KEY = 'yaari.gemini.session';
export function sessionToken() {
  try {
    return sessionStorage.getItem(SESSION_KEY) || '';
  } catch {
    return '';
  }
}
export function authHeaders(): Record<string, string> {
  const token = sessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
const offline: ApiStatus = {
  mode: 'demo',
  provider: 'demo',
  geminiConnected: false,
  liveAvailable: false,
};
function validStatus(value: unknown): value is ApiStatus {
  const s = value as Partial<ApiStatus> | undefined;
  return (
    !!s &&
    (s.mode === 'demo' || s.mode === 'live') &&
    (s.provider === 'demo' || s.provider === 'gemini' || s.provider === 'openai') &&
    typeof s.geminiConnected === 'boolean' &&
    typeof s.liveAvailable === 'boolean'
  );
}
export function useGemini() {
  const [status, setStatus] = useState<ApiStatus>(offline);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/status', {
        headers: { Accept: 'application/json', ...authHeaders() },
        cache: 'no-store',
      });
      const next = await readApiJson<ApiStatus>(
        response,
        'The app status endpoint returned an unexpected response.',
      );
      if (!validStatus(next))
        throw new ApiError('The app status endpoint returned an invalid status.');
      setStatus(next);
      if (next.source === 'session' && !next.geminiConnected) {
        try {
          sessionStorage.removeItem(SESSION_KEY);
        } catch {
          /* Storage may be unavailable. */
        }
      }
    } catch {
      setStatus(offline);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const connect = useCallback(async (key: string) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/gemini/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ apiKey: key }),
        signal: AbortSignal.timeout(20_000),
      });
      const data = await readApiJson<ApiStatus & { token?: unknown }>(
        response,
        'Gemini could not be connected. Please try again.',
      );
      if (
        typeof data.token !== 'string' ||
        !/^[A-Za-z0-9_-]{43}$/.test(data.token) ||
        data.geminiConnected !== true ||
        data.provider !== 'gemini'
      )
        throw new ApiError(
          'The app server did not return a valid Gemini session. Check that the full Yaari server is running, then try again.',
          response.status,
        );
      try {
        sessionStorage.setItem(SESSION_KEY, data.token);
      } catch {
        throw new ApiError(
          'This browser blocked session storage, so the Gemini session cannot be saved. Allow site storage or use a normal browser window.',
        );
      }
      const { token: _token, ...next } = data;
      if (!validStatus(next))
        throw new ApiError(
          'The app server returned an invalid Gemini session status. Please try again.',
          response.status,
        );
      setStatus(next);
      return true;
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error && e.name === 'TimeoutError'
            ? 'Connection timed out. Check that the Yaari server is running and can reach Gemini, then try again.'
            : e instanceof Error && e.name !== 'TypeError'
              ? e.message
              : 'Could not reach the app server. Check your connection and that the Yaari server is running, then try again.',
      );
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  const disconnect = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/gemini/disconnect', {
        method: 'POST',
        headers: { Accept: 'application/json', ...authHeaders() },
        signal: AbortSignal.timeout(15_000),
      });
      const next = await readApiJson<ApiStatus>(response, 'Couldn’t disconnect. Please try again.');
      if (!validStatus(next))
        throw new ApiError('The app server returned an invalid disconnect response.');
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        /* The server session was still revoked. */
      }
      setStatus(next);
      return true;
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error && e.name === 'TimeoutError'
            ? 'Disconnect timed out. Please try again.'
            : e instanceof Error && e.name !== 'TypeError'
              ? e.message
              : 'Couldn’t reach the app server to disconnect. Please try again.',
      );
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  return { status, loading, busy, error, connect, disconnect, refresh };
}
export type GeminiConnection = ReturnType<typeof useGemini>;
