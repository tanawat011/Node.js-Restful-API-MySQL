import { Router } from 'express';
import { dummyHash, verifyPassword } from '../../lib/password.js';
import { publicColumns } from '../Users/index.js';

const noSuchUser = { data: 'ไม่มีผู้ใช้นี้ในระบบ', is_error: true };

export default (pool) => {
  const router = Router();

  // POST, with the username and password in the JSON body: a password in a
  // GET query string ends up in server logs, proxies and browser history.
  router.post('/', async (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      res.json(noSuchUser);
      return;
    }
    const [rows] = await pool.query(
      `SELECT ${publicColumns}, password FROM ir_users WHERE username = ? LIMIT 1`,
      [username],
    );
    const ok = await verifyPassword(password, rows[0]?.password ?? dummyHash);
    if (!ok || rows.length === 0) {
      res.json(noSuchUser);
      return;
    }
    const { password: _hash, ...user } = rows[0];
    res.json({ data: [user], is_error: false });
  });

  return router;
};
