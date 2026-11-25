import { Router } from 'express';
import { publicColumns } from '../Users/index.js';

export default (pool) => {
  const router = Router();

  router.get('/', async (req, res) => {
    const { username, password } = req.query;
    if (typeof username !== 'string' || typeof password !== 'string') {
      res.json({ data: 'ไม่มีผู้ใช้นี้ในระบบ', is_error: true });
      return;
    }
    const [rows] = await pool.query(
      `SELECT ${publicColumns} FROM ir_users WHERE username = ? AND password = ? LIMIT 1`,
      [username, password],
    );
    if (rows.length === 0) res.json({ data: 'ไม่มีผู้ใช้นี้ในระบบ', is_error: true });
    else res.json({ data: rows, is_error: false });
  });

  return router;
};
