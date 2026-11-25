import { Router } from 'express';
import { HttpError, fields, idParam, list, paging } from '../../lib/http.js';
import { hashPassword } from '../../lib/password.js';

const table = 'ir_users';

// Every column but the password.
export const publicColumns = 'id, first_name, last_name, username, display_name, email, created_date, updated_date';

const spec = {
  first_name: { type: 'string' },
  last_name: { type: 'string' },
  username: { type: 'string', required: true },
  password: { type: 'string', required: true },
  display_name: { type: 'string' },
  email: { type: 'string' },
};

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

  router.post('/', async (req, res) => {
    const v = fields(req.body, spec);
    checkPassword(v.password);
    await pool.query(
      `INSERT INTO ${table} (first_name, last_name, username, password, display_name, email) VALUES (?, ?, ?, ?, ?, ?)`,
      [v.first_name ?? null, v.last_name ?? null, v.username, await hashPassword(v.password), v.display_name ?? null, v.email ?? null],
    );
    res.json('Insert Data Success!');
  });

  router.put('/:id', async (req, res) => {
    const id = idParam(req);
    // The password is optional here: left out, the old one stays.
    const v = fields(req.body, { ...spec, password: { type: 'string' } });
    const set = ['first_name = ?', 'last_name = ?', 'username = ?', 'display_name = ?', 'email = ?'];
    const params = [v.first_name ?? null, v.last_name ?? null, v.username, v.display_name ?? null, v.email ?? null];
    if (v.password) {
      checkPassword(v.password);
      set.push('password = ?');
      params.push(await hashPassword(v.password));
    }
    const [result] = await pool.query(`UPDATE ${table} SET ${set.join(', ')} WHERE id = ?`, [...params, id]);
    if (result.affectedRows === 0) throw new HttpError(404, `No user with id ${id}`);
    res.json(`Update Data ID ${id} Success!`);
  });

  router.delete('/:id', async (req, res) => {
    const id = idParam(req);
    const [result] = await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
    if (result.affectedRows === 0) throw new HttpError(404, `No user with id ${id}`);
    res.json(`Delete Data ID ${id} Success!`);
  });

  return router;
};
