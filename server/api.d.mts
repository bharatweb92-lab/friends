import type { IncomingMessage, ServerResponse } from 'node:http';
export function createApiHandler(options?: {
  env?: Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
  store?: import('./credentials.mjs').CredentialStore;
}): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
