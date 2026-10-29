import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { createApiHandler } from './api.mjs';

const app = express();
app.disable('x-powered-by');
app.use('/api', createApiHandler());
const dist = fileURLToPath(new URL('../dist', import.meta.url));
app.use(express.static(dist));
app.get('/{*path}', (_req, res) => res.sendFile(`${dist}/index.html`));
const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`Yaari is listening on http://0.0.0.0:${port}`));
