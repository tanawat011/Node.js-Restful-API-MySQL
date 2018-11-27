const table = 'user';
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
    const field = `'first_name', 'last_name', 'username', 'password', 'display_name', 'email'`;
    const value = `
      '${req.body.first_name}', '${req.body.last_name}', '${req.body.username}', '${req.body.password}', '${req.body.display_name}', '${req.body.email}'
    `;
    connect_db.query(`INSERT INTO ir_${table} (${field}) VALUES ('${value}')`, (err, rows) => {
      if (err) throw err;
      res.json('Insert Data Success!')
    });
  })

  app.put(`/${table}/:id`, (req, res) => {
    let first_name = '';
    let last_name = '';
    let username = '';
    let password = '';
    let display_name = '';
    let email = '';
    if (req.body.first_name != '' && req.body.first_name) {
      first_name = req.body.first_name;
    }
    if (req.body.last_name != '' && req.body.last_name) {
      last_name = req.body.last_name;
    }
    if (req.body.username != '' && req.body.username) {
      username = req.body.username;
    }
    if (req.body.password != '' && req.body.password) {
      password = req.body.password;
    }
    if (req.body.display_name != '' && req.body.display_name) {
      display_name = req.body.display_name;
    }
    if (req.body.email != '' && req.body.email) {
      email = req.body.email;
    }

    let value = `${first_name} ${last_name} ${username} ${password} ${display_name} ${email}`;
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