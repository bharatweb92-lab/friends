import 'dotenv/config';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createApiHandler } from './server/api.mjs';

function yaariApi(): Plugin {
  return {
    name: 'yaari-api',
    configureServer(server) {
      server.middlewares.use('/api', createApiHandler());
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api', createApiHandler());
    },
  };
}

export default defineConfig({
  plugins: [react(), yaariApi()],
  server: { host: '0.0.0.0', port: 3000, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 3000, allowedHosts: true },
});
