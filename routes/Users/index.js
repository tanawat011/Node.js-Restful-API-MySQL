import { Router } from 'express';
import { HttpError, fields, idParam, list, paging } from '../../lib/http.js';
import { endSessionsOf, requireAdmin } from '../../lib/auth.js';
import { hashPassword } from '../../lib/password.js';

const table = 'ir_users';

// Every column but the password.
export const publicColumns = 'id, first_name, last_name, username, display_name, email, role, created_date, updated_date';

const spec = {
  first_name: { type: 'string' },
  last_name: { type: 'string' },
  username: { type: 'string', required: true },
  password: { type: 'string', required: true },
  display_name: { type: 'string' },
  email: { type: 'string' },
  role: { type: 'string' },
};

const roles = ['admin', 'staff'];
function checkRole(role) {
  if (role != null && !roles.includes(role)) throw new HttpError(400, `role must be one of: ${roles.join(', ')}`);
}

// A password is kept only as a salted scrypt hash.
const minPassword = 8;
function checkPassword(password) {
  if ([...password].length < minPassword) throw new HttpError(400, `password must be at least ${minPassword} characters`);
}

export default (pool) => {
  const router = Router();

  // User 1 is the seeded administrator; the list leaves it out.
  router.get('/', async (req, res) => {
    res.json(await list(pool, {
      select: `${publicColumns}, CONCAT(first_name, ' ', last_name) AS fullname`,
      from: table,
      where: 'WHERE id != 1',
    }, paging(req.query)));
  });

  router.get('/:id', async (req, res) => {
    const [rows] = await pool.query(`SELECT ${publicColumns} FROM ${table} WHERE id = ?`, [idParam(req)]);
    res.json(rows);
  });

  // Signed-in users may read; only an administrator adds, edits or removes.
  router.post('/', requireAdmin, async (req, res) => {
    const v = fields(req.body, spec);
    checkPassword(v.password);
    checkRole(v.role);
    await pool.query(
      `INSERT INTO ${table} (first_name, last_name, username, password, display_name, email, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [v.first_name ?? null, v.last_name ?? null, v.username, await hashPassword(v.password), v.display_name ?? null, v.email ?? null, v.role ?? 'staff'],
    );
    res.json('Insert Data Success!');
  });

  router.put('/:id', requireAdmin, async (req, res) => {
    const id = idParam(req);
    // The password and role are optional here: left out, the old ones stay.
    const v = fields(req.body, { ...spec, password: { type: 'string' } });
    checkRole(v.role);
    const set = ['first_name = ?', 'last_name = ?', 'username = ?', 'display_name = ?', 'email = ?'];
    const params = [v.first_name ?? null, v.last_name ?? null, v.username, v.display_name ?? null, v.email ?? null];
    if (v.role) {
      set.push('role = ?');
      params.push(v.role);
    }
    if (v.password) {
      checkPassword(v.password);
      set.push('password = ?');
      params.push(await hashPassword(v.password));
    }
    const [result] = await pool.query(`UPDATE ${table} SET ${set.join(', ')} WHERE id = ?`, [...params, id]);
    if (result.affectedRows === 0) throw new HttpError(404, `No user with id ${id}`);
    // A new password or role signs the user out everywhere.
    if (v.password || v.role) await endSessionsOf(pool, id);
    res.json(`Update Data ID ${id} Success!`);
  });

  router.delete('/:id', requireAdmin, async (req, res) => {
    const id = idParam(req);
    if (id === req.user.id) throw new HttpError(400, 'You cannot remove your own account');
    const [result] = await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
    if (result.affectedRows === 0) throw new HttpError(404, `No user with id ${id}`);
    res.json(`Delete Data ID ${id} Success!`);
  });

  return router;
};
