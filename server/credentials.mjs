import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

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

/**
 * Stateless session store for serverless hosts. The API key is encrypted with a
 * server-only secret; the browser receives ciphertext, not the key. Disconnect
 * removes the browser token, but immediate global revocation requires rotating
 * the key in Google AI Studio because there is no shared server session store.
 */
export function createEncryptedCredentialStore({ secret, ttl = 8 * 60 * 60 * 1000 }) {
  if (typeof secret !== 'string' || !/^[A-Za-z0-9_-]{43,44}$/.test(secret))
    throw new Error('YAARI_SESSION_SECRET must be a 32-byte base64url value.');
  const key = Buffer.from(secret, 'base64url');
  if (key.length !== 32) throw new Error('YAARI_SESSION_SECRET must decode to 32 bytes.');
  const prefix = 'yaari1.';
  return {
    mode: 'encrypted',
    create(apiKey) {
      const expiresAt = Date.now() + ttl;
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(prefix));
      const plaintext = JSON.stringify({
        key: apiKey,
        expiresAt,
        nonce: randomBytes(12).toString('base64url'),
      });
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const token = `${prefix}${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
      return { token, expiresAt };
    },
    get(token) {
      if (typeof token !== 'string' || token.length > 1200 || !token.startsWith(prefix))
        return undefined;
      try {
        const [ivText, tagText, dataText, extra] = token.slice(prefix.length).split('.');
        if (extra !== undefined) return undefined;
        const iv = Buffer.from(ivText, 'base64url');
        const tag = Buffer.from(tagText, 'base64url');
        const data = Buffer.from(dataText, 'base64url');
        if (iv.length !== 12 || tag.length !== 16 || data.length < 16 || data.length > 600)
          return undefined;
        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAAD(Buffer.from(prefix));
        decipher.setAuthTag(tag);
        const parsed = JSON.parse(
          Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'),
        );
        if (
          typeof parsed.key !== 'string' ||
          parsed.key.length < 20 ||
          parsed.key.length > 200 ||
          !Number.isFinite(parsed.expiresAt) ||
          parsed.expiresAt <= Date.now()
        )
          return undefined;
        return { key: parsed.key, expiresAt: parsed.expiresAt };
      } catch {
        return undefined;
      }
    },
    delete() {
      /* Stateless: the client discards the token; Google key rotation revokes immediately. */
    },
    onRevoke() {
      return () => {};
    },
    get size() {
      return 0;
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
