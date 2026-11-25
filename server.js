import { createApp } from './app.js';
import { createPool } from './connect_db.js';

const pool = createPool();
const app = createApp(pool, { corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200' });

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const server = app.listen(port, host, () => {
  console.log(`Start server at http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => pool.end()));
}
