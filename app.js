import express from 'express';
import { requireAuth } from './lib/auth.js';
import accessories from './routes/Accessories/index.js';
import informs from './routes/Informs/index.js';
import issues from './routes/Issues/index.js';
import users from './routes/Users/index.js';
import status from './routes/Status/index.js';
import login from './routes/Login/index.js';

// createApp builds the API on a mysql2 pool. corsOrigin is the web app
// allowed to call it from a browser (the Angular client ran on :4200);
// sessionHours and loginLimit go to the sign-in routes.
export function createApp(pool, { corsOrigin = 'http://localhost:4200', sessionHours = 8, loginLimit } = {}) {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '100kb' }));

  // /login is the only way in; everything after requireAuth needs a session.
  app.use(login(pool, { hours: sessionHours, loginLimit }));
  app.use(requireAuth(pool));

  app.use('/accessories', accessories(pool));
  app.use('/informs', informs(pool));
  app.use('/issues', issues(pool));
  app.use('/users', users(pool));
  app.use('/status', status(pool));

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  // Express 5 sends a rejected promise from a route here. A database error
  // is logged, and the client gets no SQL or table names back.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status ?? err.statusCode;
    if (status >= 400 && status < 500) {
      res.status(status).json({ error: err.expose === false ? 'Bad request' : err.message });
      return;
    }
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'That value is taken' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
