import { Router } from 'express';
import { HttpError, fields, idParam, list, paging } from './http.js';

// CRUD routes for the small lookup tables (accessories, issues, status).
// `table` and the column names are fixed in the code; every value a client
// sends goes to MySQL as a ? parameter.
export function lookupRoutes(pool, table, spec) {
  const router = Router();
  const columns = Object.keys(spec);

  router.get('/', async (req, res) => {
    res.json(await list(pool, { select: '*', from: table }, paging(req.query)));
  });

  router.get('/:id', async (req, res) => {
    const [rows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [idParam(req)]);
    res.json(rows);
  });

  router.post('/', async (req, res) => {
    const values = fields(req.body, spec);
    await pool.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      columns.map((c) => values[c] ?? null));
    res.json('Insert Data Success!');
  });

  router.put('/:id', async (req, res) => {
    const id = idParam(req);
    const values = fields(req.body, spec);
    const [result] = await pool.query(`UPDATE ${table} SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...columns.map((c) => values[c] ?? null), id]);
    if (result.affectedRows === 0) throw new HttpError(404, `No row with id ${id}`);
    res.json(`Update Data ID ${id} Success!`);
  });

  router.delete('/:id', async (req, res) => {
    const id = idParam(req);
    const [result] = await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
    if (result.affectedRows === 0) throw new HttpError(404, `No row with id ${id}`);
    res.json(`Delete Data ID ${id} Success!`);
  });

  return router;
}
