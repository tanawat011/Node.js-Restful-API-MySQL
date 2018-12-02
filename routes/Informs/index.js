const table = 'informs';
module.exports = (app, connect_db) => {
  app.get(`/${table}`, (req, res) => {
    const filter = req.query.filter != 'null' && req.query.filter != '' ? `WHERE a.customer_name LIKE '%${req.query.filter}%'` : '';
    const limit = req.query.take != 'null' ? `LIMIT ${req.query.take}` : '';
    const offset = req.query.skip != 'null' ? `OFFSET ${req.query.skip}` : '';
    const issuesJoin = `LEFT JOIN ir_issues AS b ON b.id = a.issue_id`;
    const statusJoin = `LEFT JOIN ir_status AS c ON c.id = a.status_id`;
    const userOperatorJoin = `LEFT JOIN ir_users AS d ON d.id = a.user_id_operator`;
    const usersJoin = `LEFT JOIN ir_users AS e ON e.id = a.user_id`;
    const accessoriesJoin = `LEFT JOIN ir_accessories AS f ON f.id = a.accessories_id`;
    const makeField = `b.name AS issue_name, c.name AS status_name, c.color, CONCAT(d.first_name, ' ', d.last_name) AS user_name_operator, CONCAT(e.first_name, ' ', e.last_name) AS user_name, f.name AS accessories_name`;
    const makeJoin = `${issuesJoin} ${statusJoin} ${userOperatorJoin} ${usersJoin} ${accessoriesJoin}`;
    const sql = `SELECT a.*, ${makeField} FROM ir_${table} AS a ${makeJoin} ${filter} ORDER BY a.id DESC ${limit} ${offset}`;
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
    const rq = req.body;
    const field = `accessories_id, datetime_inform, customer_name, customer_tel, detail, accessories_serial_number, price, issue_id, user_id`;
    const value = `'${rq.accessories_id}', '${rq.datetime_inform}', '${rq.customer_name}', '${rq.customer_tel}', '${rq.detail}', '${rq.accessories_serial_number}', '${rq.price}', '${rq.issue_id}', '${rq.user_id}'`;
    const sql = `INSERT INTO ir_${table} (${field}) VALUES (${value})`;
    connect_db.query(sql, (err, rows) => {
      if (err) throw err;
      res.json('Insert Data Success!')
    });
  })

  app.put(`/${table}/:id`, (req, res) => {
    const datetime_operator = `datetime_operator = '${req.body.datetime_operator}'`;
    const datetime_success = `datetime_success = '${req.body.datetime_success}'`;
    const cause_solution = `cause_solution = '${req.body.cause_solution}'`;
    const user_id_operator = `user_id_operator = '${req.body.user_id_operator}'`;
    const status_id = `status_id = '${req.body.status_id}'`;
    const updateField = `${datetime_operator}, ${datetime_success}, ${cause_solution}, ${user_id_operator}, ${status_id}`;
    const sql = `UPDATE ir_${table} SET ${updateField} WHERE id = ${req.params.id}`;
    connect_db.query(sql, (err, rows) => {
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