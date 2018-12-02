const table = 'status';
module.exports = (app, connect_db) => {
  app.get(`/${table}`, (req, res) => {
    const limit = req.query.take != 'null' ? `LIMIT ${req.query.take}` : '';
    const offset = req.query.skip != 'null' ? `OFFSET ${req.query.skip}` : '';
    const sql = `SELECT * FROM ir_${table} ${limit} ${offset}`;
    connect_db.query(sql, (err, rows) => {
      if (err) throw err;
      if (limit && limit != '') {
        connect_db.query(`SELECT * FROM ir_${table}`, (err, rowsLength) => {
          if (err) throw err;
          res.json({ data: rows, total: rowsLength.length });
        });
      } else {
        res.json(rows);
      }
    });
  });

  app.get(`/${table}/:id`, (req, res) => {
    const sql = `SELECT * FROM ir_${table} WHERE id = ${req.params.id}`;
    connect_db.query(sql, (err, rows) => {
      if (err) throw err;
      res.json(rows)
    });
  })

  app.post(`/${table}`, (req, res) => {
    const sql = `INSERT INTO ir_${table} (name, color) VALUES ('${req.body.name}', '${req.body.color}')`;
    connect_db.query(sql, (err, rows) => {
      if (err) throw err;
      res.json('Insert Data Success!')
    });
  })

  app.put(`/${table}/:id`, (req, res) => {
    const sql = `UPDATE ir_${table} SET name = '${req.body.name}', color = '${req.body.color}' WHERE id = ${req.params.id}`;
    connect_db.query(sql, (err, rows) => {
      if (err) throw err;
      res.json(`Update Data ID ${req.params.id} Success!`)
    });
  })

  app.delete(`/${table}/:id`, (req, res) => {
    const sql = `DELETE FROM ir_${table} WHERE id = ${req.params.id}`;
    connect_db.query(sql, (err, rows) => {
      if (err) throw err;
      res.json(`Delete Data ID ${req.params.id} Success!`)
    });
  })
}