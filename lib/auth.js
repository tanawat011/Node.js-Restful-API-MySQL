// Sign-in sessions: an opaque random token the client sends as
//   Authorization: Bearer <token>
// The server keeps only the token's SHA-256 (ir_sessions), with the user
// and an expiry. Signing out deletes the row, so a token stops working at
// once. (Chosen over JWT + refresh tokens: no signing key to keep secret
// and rotate, no refresh flow, and revocation is immediate; the price is
// one indexed lookup per request, nothing for an app this size.)
import { createHash, randomBytes } from 'node:crypto';
import { HttpError } from './http.js';

export const sessionHours = (env = process.env) => {
  const h = Number(env.SESSION_TTL_HOURS || 8);
  return Number.isFinite(h) && h > 0 ? h : 8;
};

const digest = (token) => createHash('sha256').update(token).digest('hex');

// createSession returns a new token for userId and when it expires (UTC).
export async function createSession(pool, userId, hours) {
  const token = randomBytes(32).toString('base64url');
  await pool.query('DELETE FROM ir_sessions WHERE expires_at <= UTC_TIMESTAMP()');
  await pool.query(
    'INSERT INTO ir_sessions (id, user_id, expires_at) VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL ? SECOND)',
    [digest(token), userId, Math.round(hours * 3600)],
  );
  const [[{ expires_at }]] = await pool.query('SELECT expires_at FROM ir_sessions WHERE id = ?', [digest(token)]);
  return { token, expires_at: `${expires_at.replace(' ', 'T')}Z` };
}

export async function endSession(pool, token) {
  await pool.query('DELETE FROM ir_sessions WHERE id = ?', [digest(token)]);
}

export async function endSessionsOf(pool, userId) {
  await pool.query('DELETE FROM ir_sessions WHERE user_id = ?', [userId]);
}

function bearer(req) {
  const m = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(req.get('authorization') ?? '');
  return m ? m[1] : null;
}

// requireAuth lets a request through only with a live session; req.user is
// then { id, username, role } and req.token the token itself.
export function requireAuth(pool) {
  return async (req, res, next) => {
    const token = bearer(req);
    if (!token) {
      res.set('WWW-Authenticate', 'Bearer');
      throw new HttpError(401, 'Sign in first: POST /login, then send Authorization: Bearer <token>');
    }
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.role FROM ir_sessions AS s JOIN ir_users AS u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > UTC_TIMESTAMP()`,
      [digest(token)],
    );
    if (rows.length === 0) {
      res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
      throw new HttpError(401, 'The session has ended or is not valid; sign in again');
    }
    req.user = rows[0];
    req.token = token;
    next();
  };
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') throw new HttpError(403, 'Only an administrator may do this');
  next();
}
