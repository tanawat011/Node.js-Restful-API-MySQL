const table = 'users';
module.exports = (app, connect_db) => {
  app.get(`/${table}`, (req, res) => {
    const limit = req.query.take != 'null' ? `LIMIT ${req.query.take}` : '';
    const offset = req.query.skip != 'null' ? `OFFSET ${req.query.skip}` : '';
    const sql = `SELECT *, CONCAT(first_name , ' ', last_name) AS fullname FROM ir_${table} WHERE id != 1 ${limit} ${offset}`;
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
    connect_db.query(`SELECT * FROM ir_${table} WHERE id = ${req.params.id}`, (err, rows) => {
      if (err) throw err;
      res.json(rows)
    });
  })

  app.post(`/${table}`, (req, res) => {
    const field = `first_name, last_name, username, password, display_name, email`;
    const value = `
      '${req.body.first_name}', '${req.body.last_name}', '${req.body.username}', '${req.body.password}', '${req.body.display_name}', '${req.body.email}'
    `;
    const sql = `INSERT INTO ir_${table} (${field}) VALUES (${value.replace(/\s/g, '')})`;
    connect_db.query(sql, (err, rows) => {
      if (err) throw err;
      res.json('Insert Data Success!')
    });
  })

  app.put(`/${table}/:id`, (req, res) => {
    const first_name = `first_name = '${req.body.first_name}'`;
    const last_name = `last_name = '${req.body.last_name}'`;
    const username = `username = '${req.body.username}'`;
    const password = `password = '${req.body.password}'`;
    const display_name = `display_name = '${req.body.display_name}'`;
    const email = `email = '${req.body.email}'`;

    let value = `${first_name}, ${last_name}, ${username}, ${password}, ${display_name}, ${email}`;
    connect_db.query(`UPDATE ir_${table} SET ${value} WHERE id = ${req.params.id}`, (err, rows) => {
      if (err) throw err;
      res.json(`Update Data ID ${req.params.id} Success!`)
    });
  })

  app.delete(`/${table}/:id`, (req, res) => {
    connect_db.query(`DELETE FROM ir_${table} WHERE id = ${req.params.id}`, (err, rows) => {
      if (err) throw err;
      res.json(`Delete Data ID ${req.params.id} Success!`)
    });
  })
}