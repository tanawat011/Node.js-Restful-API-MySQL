import { Router } from 'express';
import { HttpError, fields, idParam, list, paging } from '../../lib/http.js';

const table = 'ir_informs';

const createSpec = {
  accessories_id: { type: 'int', required: true },
  datetime_inform: { type: 'datetime' },
  customer_name: { type: 'string' },
  customer_tel: { type: 'string' },
  detail: { type: 'text' },
  accessories_serial_number: { type: 'string' },
  price: { type: 'string' },
  issue_id: { type: 'int', required: true },
  user_id: { type: 'int', required: true },
};

const updateSpec = {
  datetime_operator: { type: 'datetime' },
  datetime_success: { type: 'datetime' },
  cause_solution: { type: 'text' },
  user_id_operator: { type: 'int' },
  status_id: { type: 'int' },
};

const joined = `${table} AS a
  LEFT JOIN ir_issues AS b ON b.id = a.issue_id
  LEFT JOIN ir_status AS c ON c.id = a.status_id
  LEFT JOIN ir_users AS d ON d.id = a.user_id_operator
  LEFT JOIN ir_users AS e ON e.id = a.user_id
  LEFT JOIN ir_accessories AS f ON f.id = a.accessories_id`;

const names = `b.name AS issue_name, c.name AS status_name, c.color,
  CONCAT(d.first_name, ' ', d.last_name) AS user_name_operator,
  CONCAT(e.first_name, ' ', e.last_name) AS user_name, f.name AS accessories_name`;

// LIKE treats % and _ as wildcards; a customer name may hold them.
const likeText = (s) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export default (pool) => {
  const router = Router();

  router.get('/', async (req, res) => {
    const filter = req.query.filter;
    const filtered = typeof filter === 'string' && filter !== '' && filter !== 'null';
    res.json(await list(pool, {
      select: `a.*, ${names}`,
      from: joined,
      where: filtered ? 'WHERE a.customer_name LIKE ?' : '',
      params: filtered ? [likeText(filter)] : [],
      order: 'ORDER BY a.id DESC',
    }, paging(req.query)));
  });

  router.get('/:id', async (req, res) => {
    const [rows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [idParam(req)]);
    res.json(rows);
  });

  router.post('/', async (req, res) => {
    const values = fields(req.body, createSpec);
    const columns = Object.keys(createSpec);
    await pool.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      columns.map((c) => values[c] ?? null));
    res.json('Insert Data Success!');
  });

  router.put('/:id', async (req, res) => {
    const id = idParam(req);
    const values = fields(req.body, updateSpec);
    const columns = Object.keys(updateSpec);
    const [result] = await pool.query(`UPDATE ${table} SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...columns.map((c) => values[c] ?? null), id]);
    if (result.affectedRows === 0) throw new HttpError(404, `No inform with id ${id}`);
    res.json(`Update Data ID ${id} Success!`);
  });

  router.delete('/:id', async (req, res) => {
    const id = idParam(req);
    const [result] = await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
    if (result.affectedRows === 0) throw new HttpError(404, `No inform with id ${id}`);
    res.json(`Delete Data ID ${id} Success!`);
  });

  return router;
};
