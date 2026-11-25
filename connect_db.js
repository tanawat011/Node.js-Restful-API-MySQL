import mysql from 'mysql2/promise';

// A pool of connections to the database named by DB_NAME (or `database`),
// with the account from DB_HOST / DB_PORT / DB_USER / DB_PASSWORD.
// See .env.example.
export function createPool(env = process.env, database = env.DB_NAME) {
  if (!env.DB_USER || !database) {
    throw new Error('Set DB_USER and DB_NAME (see .env.example)');
  }
  return mysql.createPool({
    host: env.DB_HOST || '127.0.0.1',
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database,
    charset: 'utf8mb4',
    dateStrings: true, // DATETIME / TIMESTAMP as written, no time-zone shift
    connectionLimit: 10,
  });
}
