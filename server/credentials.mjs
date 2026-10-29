import { randomBytes } from 'node:crypto';

/** Keys live only in this process. The browser receives an opaque, expiring session id. */
export function createCredentialStore({ ttl = 8 * 60 * 60 * 1000, maxSessions = 500 } = {}) {
  const sessions = new Map();
  const revocations = new Map();
  function prune() {
    const now = Date.now();
    for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token);
  }
  return {
    create(key) {
      prune();
      if (sessions.size >= maxSessions) this.delete(sessions.keys().next().value);
      const token = randomBytes(32).toString('base64url');
      const session = { key, expiresAt: Date.now() + ttl };
      sessions.set(token, session);
      return { token, expiresAt: session.expiresAt };
    },
    get(token) {
      if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return undefined;
      const session = sessions.get(token);
      if (!session) return undefined;
      if (session.expiresAt <= Date.now()) {
        sessions.delete(token);
        return undefined;
      }
      return session;
    },
    delete(token) {
      sessions.delete(token);
      for (const callback of revocations.get(token) ?? []) callback();
      revocations.delete(token);
    },
    onRevoke(token, callback) {
      if (!revocations.has(token)) revocations.set(token, new Set());
      revocations.get(token).add(callback);
      return () => {
        revocations.get(token)?.delete(callback);
        if (!revocations.get(token)?.size) revocations.delete(token);
      };
    },
    get size() {
      prune();
      return sessions.size;
    },
  };
}

const sharedStore = createCredentialStore();
export const getSharedStore = () => sharedStore;
export const bearerToken = (req) => {
  const value = req.headers?.authorization ?? '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
};
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
      .split(',')[0]
      .trim();
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
