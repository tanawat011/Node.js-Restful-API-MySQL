const mysql = require('mysql');
const con = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'inform_repair'
});

const ID = `id int NOT NULL PRIMARY KEY AUTO_INCREMENT`;
const created_date = `created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;
const updated_date = `updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`;
const dated = `${created_date}, ${updated_date}`;

con.connect((err) => {
  if (err) throw err;
  console.log('Connected!');
  // ===== create table =====
  con.query(`CREATE TABLE ir_departments (
      ${ID},
      name VARCHAR(255),
      address VARCHAR(255),
      ${dated}
    ) CHARACTER SET utf8 COLLATE utf8_unicode_ci`, (err, result) => {
    if (err) throw err;
    console.log('Table departments created');
  });
  con.query(`CREATE TABLE ir_sub_departments (
      ${ID},
      departments_id int NOT NULL,
      name VARCHAR(255),
      address VARCHAR(255),
      ${dated}
    ) CHARACTER SET utf8 COLLATE utf8_unicode_ci`, (err, result) => {
    if (err) throw err;
    console.log('Table sub_departments created');
  });
  con.query(`CREATE TABLE ir_place (
      ${ID},
      sub_departments_id int NOT NULL,
      name VARCHAR(255),
      address VARCHAR(255),
      ${dated}
    ) CHARACTER SET utf8 COLLATE utf8_unicode_ci`, (err, result) => {
    if (err) throw err;
    console.log('Table place created');
  });
  con.query(`CREATE TABLE ir_user (
      ${ID},
      first_name VARCHAR(255),
      last_name VARCHAR(255),
      username VARCHAR(255),
      password VARCHAR(255),
      display_name VARCHAR(255),
      email VARCHAR(255),
      ${dated}
    ) CHARACTER SET utf8 COLLATE utf8_unicode_ci`, (err, result) => {
    if (err) throw err;
    console.log('Table user created');
  });
  con.query(`CREATE TABLE ir_employee (
      ${ID},
      sub_departments_id int NOT NULL,
      first_name VARCHAR(255),
      last_name VARCHAR(255),
      address VARCHAR(255),
      ${dated}
    ) CHARACTER SET utf8 COLLATE utf8_unicode_ci`, (err, result) => {
    if (err) throw err;
    console.log('Table employee created');
  });
  con.query(`CREATE TABLE ir_accessories (
      ${ID},
      name VARCHAR(255),
      ${dated}
    ) CHARACTER SET utf8 COLLATE utf8_unicode_ci`, (err, result) => {
    if (err) throw err;
    console.log('Table accessories created');
  });
  con.query(`CREATE TABLE ir_issue (
      ${ID},
      name VARCHAR(255),
      ${dated}
    ) CHARACTER SET utf8 COLLATE utf8_unicode_ci`, (err, result) => {
    if (err) throw err;
    console.log('Table issue created');
  });
  con.query(`CREATE TABLE ir_inform (
      ${ID},
      date DATE,
      sub_departments_id int NOT NULL,
      place_id int NOT NULL,
      employee_id int NOT NULL,
      accessories_id int NOT NULL,
      issue_id int NOT NULL,
      detail TEXT,
      ${dated}
    ) CHARACTER SET utf8 COLLATE utf8_unicode_ci`, (err, result) => {
    if (err) throw err;
    console.log('Table inform created');
  });
});