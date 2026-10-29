import { useCallback, useEffect, useState } from 'react';
import type { ApiStatus } from './types';

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
export function useGemini() {
  const [status, setStatus] = useState<ApiStatus>(offline);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/status', { headers: authHeaders(), cache: 'no-store' });
      if (!response.ok) throw new Error();
      const next: ApiStatus = await response.json();
      setStatus(next);
      if (next.source === 'session' && !next.geminiConnected)
        sessionStorage.removeItem(SESSION_KEY);
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
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ apiKey: key }),
        signal: AbortSignal.timeout(20_000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gemini could not be connected.');
      sessionStorage.setItem(SESSION_KEY, data.token);
      const { token: _token, ...next } = data;
      setStatus(next);
      return true;
    } catch (e) {
      setError(
        e instanceof Error && e.name !== 'TimeoutError'
          ? e.message
          : 'Connection timed out. Please try again.',
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
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error('Couldn’t disconnect. Please try again.');
      sessionStorage.removeItem(SESSION_KEY);
      setStatus(await response.json());
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t disconnect.');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);
  return { status, loading, busy, error, connect, disconnect, refresh };
}
export type GeminiConnection = ReturnType<typeof useGemini>;
