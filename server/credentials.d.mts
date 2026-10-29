import type { IncomingMessage } from 'node:http';
export type CredentialStore = {
  create(key: string): { token: string; expiresAt: number };
  get(token: string): { key: string; expiresAt: number } | undefined;
  delete(token: string): void;
  onRevoke(token: string, callback: () => void): () => void;
  readonly size: number;
};
export function createCredentialStore(options?: {
  ttl?: number;
  maxSessions?: number;
}): CredentialStore;
export function getSharedStore(): CredentialStore;
export function bearerToken(req: IncomingMessage): string;
export function sameOrigin(req: IncomingMessage): boolean;
