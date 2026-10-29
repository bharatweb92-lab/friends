import type { IncomingMessage, ServerResponse } from 'node:http';
export function createApiHandler(options?: {
  env?: Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
}): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
