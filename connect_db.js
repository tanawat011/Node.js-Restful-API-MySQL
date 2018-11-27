const mysql = require('mysql');
const connect_db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'inform_repair'
});

connect_db.connect((err) => {
  if (err) throw err;
  console.log('Connected!');
});

module.exports = connect_db;