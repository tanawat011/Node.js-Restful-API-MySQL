const table = 'departments';
module.exports = (app, connect_db) => {
  app.get(`/${table}`, (req, res) => {
    connect_db.query(`SELECT * FROM ir_${table}`, (err, rows) => {
      if (err) throw err;
      res.json(rows)
    });
  });

  app.get(`/${table}/:id`, (req, res) => {
    connect_db.query(`SELECT * FROM ir_${table} WHERE id = ${req.params.id}`, (err, rows) => {
      if (err) throw err;
      res.json(rows)
    });
  })

  app.post(`/${table}`, (req, res) => {
    connect_db.query(`INSERT INTO ir_${table} (name) VALUES ('${req.body.name}')`, (err, rows) => {
      if (err) throw err;
      res.json('Insert Data Success!')
    });
  })

  app.put(`/${table}/:id`, (req, res) => {
    connect_db.query(`UPDATE ir_${table} SET name = '${req.body.name}' WHERE id = ${req.params.id}`, (err, rows) => {
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