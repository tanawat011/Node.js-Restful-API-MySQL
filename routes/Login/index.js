const table = 'users';
module.exports = (app, connect_db) => {
  app.get(`/login`, (req, res) => {
    let username = req.query.username;
    let password = req.query.password;
    connect_db.query(`SELECT * FROM ir_${table} WHERE username = '${username}' AND password = '${password}' LIMIT 1`, (err, rows) => {
      if (err == null) {
        if (rows.length == 0) res.json({ data: 'ไม่มีผู้ใช้นี้ในระบบ', is_error: true });
        if (rows.length > 0) res.json({ data: rows, is_error: false });
      } else {
        throw err;
      }
    });
  });
}