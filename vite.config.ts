import 'dotenv/config';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createApiHandler } from './server/api.mjs';
import { attachLiveServer } from './server/live.mjs';

function yaariApi(): Plugin {
  return {
    name: 'yaari-api',
    configureServer(server) {
      server.middlewares.use('/api', createApiHandler());
      if (server.httpServer) {
        const live = attachLiveServer(server.httpServer);
        server.httpServer.on('close', () => live.close());
      }
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api', createApiHandler());
      const live = attachLiveServer(server.httpServer);
      server.httpServer.on('close', () => live.close());
    },
  };
}
export default defineConfig({
  plugins: [react(), yaariApi()],
  server: { host: '0.0.0.0', port: 3000, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 3000, allowedHosts: true },
});
