const table = 'sub_departments';
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
    connect_db.query(`INSERT INTO ir_${table} (departments_id, name) VALUES ('${req.body.departments_id}', '${req.body.name}')`, (err, rows) => {
      if (err) throw err;
      res.json('Insert Data Success!')
    });
  })

  app.put(`/${table}/:id`, (req, res) => {
    let departments_id = '';
    let name = '';
    if (req.body.departments_id != '' && req.body.departments_id) {
      departments_id = req.body.departments_id;
    }
    if (req.body.name != '' && req.body.name) {
      name = req.body.name;
    }
    connect_db.query(`UPDATE ir_${table} SET ${departments_id} ${name} WHERE id = ${req.params.id}`, (err, rows) => {
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