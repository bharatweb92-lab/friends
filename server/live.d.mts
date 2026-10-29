import type { Server } from 'node:http';
import type { Http2SecureServer } from 'node:http2';
import type { CredentialStore } from './credentials.mjs';
export function attachLiveServer(
  server: Server | Http2SecureServer,
  options?: {
    store?: CredentialStore;
    env?: Record<string, string | undefined>;
    connect?: (
      config: Record<string, unknown>,
      callbacks: Record<string, unknown>,
    ) => Promise<{
      close(): void;
      sendRealtimeInput(input: unknown): void;
      sendClientContent(input: unknown): void;
    }>;
    maxActive?: number;
  },
): { close(): void; readonly activeCalls: number };
