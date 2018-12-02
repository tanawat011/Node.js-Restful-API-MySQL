const mysql = require('mysql');
const con = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: ''
});

// Set Primary Key
const ID = `id int NOT NULL PRIMARY KEY AUTO_INCREMENT`;

// Set Create and Update to Timestamp
const created_date = `created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;
const updated_date = `updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`;
const dated = `${created_date}, ${updated_date}`;

// Set Field Type
const vc = 'VARCHAR(255)';
const int = 'int NOT NULL';

// Character Set
const character = 'CHARACTER SET utf8 COLLATE utf8_unicode_ci';

const migrateSettings = [
  {
    table: 'ir_users',
    field: `${ID}, first_name ${vc}, last_name ${vc}, username ${vc}, password ${vc}, display_name ${vc}, email ${vc}, ${dated}`
  },
  {
    table: 'ir_accessories',
    field: `${ID}, name ${vc}, ${dated}`
  },
  {
    table: 'ir_issues',
    field: `${ID}, name ${vc}, ${dated}`
  },
  {
    table: 'ir_informs',
    field: `${ID}, user_id ${int}, user_id_operator int NULL, datetime_inform DATETIME, datetime_operator DATETIME, datetime_success DATETIME, customer_name ${vc}, customer_tel ${vc}, accessories_id ${int}, accessories_serial_number ${vc}, price ${vc}, issue_id ${int}, cause_solution TEXT, detail TEXT, status_id int NULL, ${dated}`
  },
  {
    table: 'ir_status',
    field: `${ID}, name ${vc}, color ${vc}, ${dated}`
  }
];

con.connect((err) => {
  if (err) throw err;
  console.log('Connected!');
  // ===== Drop Database =====
  con.query('DROP DATABASE inform_repair', (err, result) => {
    if (err) console.log('No Database Name inform_repair!!!');
    console.log('Delete Database inform_repair => success!!!');
  });
  // ===== Drop Database =====

  // ===== Create Database =====
  con.query('CREATE DATABASE inform_repair', (err, result) => {
    if (err) throw err;
    console.log('Database inform_repair => created');
  });
  // ===== Create Database =====

  // ===== Use Database =====
  con.query('USE inform_repair', (err, result) => {
    if (err) throw err;
    console.log('Database inform_repair => Used');
  });
  // ===== Use Database =====

  // ===== create table =====
  migrateSettings.forEach(({ table, field }) => {
    const sql = `CREATE TABLE ${table} (${field}) ${character}`;
    // console.log(sql)
    con.query(sql, (err, result) => {
      if (err) throw err;
      console.log(`Table ${table} => Created`);
    });
  });
  // ===== create table =====

  // ===== Seed data =====
  // ===== Seed User =====
  const fieldSeedUser = 'first_name, last_name, username, password, display_name, email';
  const valueSeedUser = `'Super', 'Admin', 'superadmin', 'superadmin', 'Super Admin', 'super@admin.com'`;
  con.query(`INSERT INTO ir_users (${fieldSeedUser}) VALUES (${valueSeedUser})`, (err, result) => {
    if (err) throw err;
    console.log(`Insert Starter User => Success!!!`);
  });
  // ===== Seed User =====

  // ===== Seed Status =====
  const fieldSeedStatus = 'name, color';
  const valueSeedStatus = [
    { name: 'รอตรวจสอบ', color: '#f31700' },
    { name: 'อยู่ระหว่างดำเนินการ', color: '#0076c6' },
    { name: 'สำเร็จ', color: '#00b900' },
  ];
  valueSeedStatus.forEach(item => {
    con.query(`INSERT INTO ir_status (${fieldSeedStatus}) VALUES ('${item.name}', '${item.color}')`, (err, result) => {
      if (err) throw err;
      console.log(`Insert Starter Status "${item.name}" => Success!!!`);
    });
  });
  // ===== Seed Status =====
  // ===== Seed data =====

});
