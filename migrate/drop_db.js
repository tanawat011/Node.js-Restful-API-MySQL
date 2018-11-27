const mysql = require('mysql');
const con = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: ''
});

con.connect((err) => {
  if (err) throw err;
  console.log('Connected!');
  // ===== create Database =====
  con.query('DROP DATABASE inform_repair', (err, result) => {
    if (err) throw err;
    console.log('Delete Database inform_repair success!!!');
  });
});