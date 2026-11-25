// Creates the inform_repair tables and their starter rows.
//
//   npm run migrate            make what is missing; existing data is kept
//   npm run migrate -- --fresh drop the five tables first (their data is lost)
//
// The 2018 version dropped the whole database on every run.
import { pathToFileURL } from 'node:url';
import mysql from 'mysql2/promise';
import { hashPassword } from '../lib/password.js';

const ID = 'id INT NOT NULL PRIMARY KEY AUTO_INCREMENT';
const dated = 'created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP';
const vc = 'VARCHAR(255)';
const int = 'INT NOT NULL';
const character = 'CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci';

export const tables = [
  { table: 'ir_users', field: `${ID}, first_name ${vc}, last_name ${vc}, username ${vc} NOT NULL UNIQUE, password ${vc} NOT NULL, display_name ${vc}, email ${vc}, ${dated}` },
  { table: 'ir_accessories', field: `${ID}, name ${vc}, ${dated}` },
  { table: 'ir_issues', field: `${ID}, name ${vc}, ${dated}` },
  { table: 'ir_informs', field: `${ID}, user_id ${int}, user_id_operator INT NULL, datetime_inform DATETIME, datetime_operator DATETIME, datetime_success DATETIME, customer_name ${vc}, customer_tel ${vc}, accessories_id ${int}, accessories_serial_number ${vc}, price ${vc}, issue_id ${int}, cause_solution TEXT, detail TEXT, status_id INT NULL, ${dated}` },
  { table: 'ir_status', field: `${ID}, name ${vc}, color ${vc}, ${dated}` },
];

const statuses = [
  { name: 'รอตรวจสอบ', color: '#f31700' },
  { name: 'อยู่ระหว่างดำเนินการ', color: '#0076c6' },
  { name: 'สำเร็จ', color: '#00b900' },
];

// migrate runs on a connection already using the target database.
export async function migrate(conn, { fresh = false, adminPassword, log = console.log } = {}) {
  if (fresh) {
    for (const { table } of tables) {
      await conn.query(`DROP TABLE IF EXISTS ${table}`);
      log(`Table ${table} => dropped`);
    }
  }
  for (const { table, field } of tables) {
    await conn.query(`CREATE TABLE IF NOT EXISTS ${table} (${field}) ${character}`);
    log(`Table ${table} => ready`);
  }

  const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM ir_status');
  if (n === 0) {
    for (const s of statuses) {
      await conn.query('INSERT INTO ir_status (name, color) VALUES (?, ?)', [s.name, s.color]);
    }
    log('Starter statuses => inserted');
  }

  // The administrator is user 1, made only when a password is given.
  if (adminPassword) {
    const [rows] = await conn.query('SELECT id FROM ir_users WHERE username = ?', ['superadmin']);
    if (rows.length === 0) {
      await conn.query(
        'INSERT INTO ir_users (id, first_name, last_name, username, password, display_name, email) VALUES (1, ?, ?, ?, ?, ?, ?)',
        ['Super', 'Admin', 'superadmin', await hashPassword(adminPassword), 'Super Admin', 'super@admin.example'],
      );
      log('User superadmin => inserted');
    }
  } else {
    log('SEED_ADMIN_PASSWORD is not set: no administrator was made');
  }
}

async function main() {
  const env = process.env;
  const database = env.DB_NAME;
  if (!env.DB_USER || !database) throw new Error('Set DB_USER and DB_NAME (see .env.example)');
  if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error('DB_NAME may hold only letters, digits and _');
  const conn = await mysql.createConnection({
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    charset: 'utf8mb4',
  });
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` ${character}`);
    await conn.query(`USE \`${database}\``);
    await migrate(conn, { fresh: process.argv.includes('--fresh'), adminPassword: env.SEED_ADMIN_PASSWORD });
  } finally {
    await conn.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
