import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApiHandler } from './api.mjs';
import { attachLiveServer } from './live.mjs';

const app = express();
app.disable('x-powered-by');
app.use('/api', createApiHandler());
const dist = fileURLToPath(new URL('../dist', import.meta.url));
app.use(express.static(dist));
app.get('/{*path}', (_req, res) => res.sendFile(`${dist}/index.html`));
const server = createServer(app);
const live = attachLiveServer(server);
const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => console.log(`Yaari is listening on http://0.0.0.0:${port}`));
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () => {
    live.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
