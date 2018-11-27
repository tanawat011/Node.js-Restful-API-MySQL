const table = 'employee';
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
    connect_db.query(`
        INSERT INTO ir_${table} (sub_departments_id, first_name, last_name) VALUES ('${req.body.sub_departments_id}', '${req.body.first_name}', '${req.body.last_name}')
      `, (err, rows) => {
        if (err) throw err;
        res.json('Insert Data Success!')
      });
  })

  app.put(`/${table}/:id`, (req, res) => {
    let sub_departments_id = '';
    let first_name = '';
    let last_name = '';
    if (req.body.sub_departments_id != '' && req.body.sub_departments_id) {
      sub_departments_id = `sub_departments_id = '${req.body.sub_departments_id}'`;
    }
    if (req.body.first_name != '' && req.body.first_name) {
      first_name = `first_name = '${req.body.first_name}'`;
    }
    if (req.body.last_name != '' && req.body.last_name) {
      last_name = `last_name = '${req.body.last_name}'`;
    }
    connect_db.query(`UPDATE ir_${table} SET ${sub_departments_id} ${first_name} ${last_name} WHERE id = ${req.params.id}`, (err, rows) => {
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