import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createSession, endSession, requireAuth } from '../../lib/auth.js';
import { dummyHash, verifyPassword } from '../../lib/password.js';
import { publicColumns } from '../Users/index.js';

const noSuchUser = { data: 'ไม่มีผู้ใช้นี้ในระบบ', is_error: true };

// loginLimit: { windowMs, limit } — failed sign-ins allowed per client
// address in the window; past it every sign-in from there answers 429.
export default (pool, { hours, loginLimit = { windowMs: 15 * 60 * 1000, limit: 5 } } = {}) => {
  const router = Router();

  const limiter = rateLimit({
    ...loginLimit,
    skipSuccessfulRequests: true, // only failed sign-ins count
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { data: 'ลองเข้าสู่ระบบผิดหลายครั้งเกินไป — too many failed sign-ins, try again later', is_error: true },
  });

  // POST, with the username and password in the JSON body: a password in a
  // GET query string ends up in server logs, proxies and browser history.
  router.post('/login', limiter, async (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      res.status(401).json(noSuchUser);
      return;
    }
    const [rows] = await pool.query(
      `SELECT ${publicColumns}, password FROM ir_users WHERE username = ? LIMIT 1`,
      [username],
    );
    const ok = await verifyPassword(password, rows[0]?.password ?? dummyHash);
    if (!ok || rows.length === 0) {
      res.status(401).json(noSuchUser);
      return;
    }
    const { password: _hash, ...user } = rows[0];
    const session = await createSession(pool, user.id, hours);
    res.json({ data: [user], is_error: false, ...session });
  });

  router.post('/logout', requireAuth(pool), async (req, res) => {
    await endSession(pool, req.token);
    res.status(204).end();
  });

  return router;
};
