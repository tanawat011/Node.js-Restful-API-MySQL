// The API end to end. The tests marked "database" run against the MySQL
// database named by TEST_DB_NAME (with DB_HOST / DB_PORT / DB_USER /
// DB_PASSWORD) and DROP AND REMAKE its tables; without TEST_DB_NAME they are
// skipped. The others never reach a database.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../app.js';
import { createPool } from '../connect_db.js';
import { migrate } from '../migrate/db.js';

async function serve(pool, options = {}) {
  const server = createApp(pool, { corsOrigin: 'http://example.test', ...options }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  // call(method, path, body, token)
  const call = async (method, path, body, token) => {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await fetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  };
  return { server, call };
}

const sha = (s) => createHash('sha256').update(s).digest('hex');

describe('without a database', () => {
  // Stand-in tokens. The session lookup is answered here; any other query
  // fails the test, so these requests must be settled before other SQL.
  const ADMIN = 'admin-token-aaaaaaaaaaaaaaaa';
  const STAFF = 'staff-token-bbbbbbbbbbbbbbbb';
  const sessions = { [sha(ADMIN)]: { id: 1, username: 'superadmin', role: 'admin' }, [sha(STAFF)]: { id: 2, username: 'staff', role: 'staff' } };
  const pool = {
    async query(sql, params) {
      if (sql.includes('FROM ir_sessions')) return [sessions[params[0]] ? [sessions[params[0]]] : []];
      throw new Error('the database was reached');
    },
  };
  let api;
  before(async () => { api = await serve(pool); });
  after(() => api.server.close());

  test('401 without a token, with a malformed one, or an unknown one', async () => {
    for (const path of ['/accessories', '/informs', '/issues', '/status', '/users', '/users/1']) {
      const r = await api.call('GET', path);
      assert.equal(r.status, 401, path);
      assert.equal(r.headers.get('www-authenticate'), 'Bearer', path);
    }
    for (const [method, path] of [['POST', '/accessories'], ['PUT', '/informs/1'], ['DELETE', '/users/2'], ['POST', '/logout']]) {
      assert.equal((await api.call(method, path, {})).status, 401, `${method} ${path}`);
    }
    const res = await fetch(`http://127.0.0.1:${api.server.address().port}/issues`, { headers: { authorization: `Basic ${ADMIN}` } });
    assert.equal(res.status, 401);
    const unknown = await api.call('GET', '/issues', undefined, 'not-a-session-cccccccccccccccc');
    assert.equal(unknown.status, 401);
    assert.match(unknown.headers.get('www-authenticate'), /invalid_token/);
  });

  test('403 when a staff member manages users', async () => {
    for (const [method, path, body] of [
      ['POST', '/users', { username: 'x', password: 'long enough pw' }],
      ['PUT', '/users/3', { username: 'x' }],
      ['DELETE', '/users/3'],
    ]) {
      const r = await api.call(method, path, body, STAFF);
      assert.equal(r.status, 403, `${method} ${path}`);
    }
  });

  test('bad ids and paging are refused with 400', async () => {
    for (const path of ['/accessories/abc', '/users/0', '/informs/1%20OR%201=1', '/status?take=x', '/issues?take=-1']) {
      const r = await api.call('GET', path, undefined, ADMIN);
      assert.equal(r.status, 400, path);
      assert.ok(r.body.error, path);
    }
  });

  test('bad bodies are refused with 400', async () => {
    const cases = [
      ['POST', '/accessories', {}],
      ['POST', '/status', { name: 'x'.repeat(256) }],
      ['POST', '/users', { username: 'a', password: 'short' }],
      ['POST', '/users', { username: 'a', password: 'long enough pw', role: 'root' }],
      ['POST', '/informs', { user_id: 1, issue_id: 1 }],
      ['PUT', '/informs/1', { status_id: 'two' }],
      ['DELETE', '/users/1'], // an administrator cannot remove themselves
    ];
    for (const [method, path, body] of cases) {
      const r = await api.call(method, path, body, ADMIN);
      assert.equal(r.status, 400, `${method} ${path}`);
    }
  });

  test('a broken JSON body is a 400, an unknown path a 404', async () => {
    assert.equal((await api.call('POST', '/issues', '{', ADMIN)).status, 400);
    assert.equal((await api.call('GET', '/nothing', undefined, ADMIN)).status, 404);
  });

  test('CORS allows the configured origin, the Authorization header, and answers preflight', async () => {
    const r = await api.call('OPTIONS', '/users');
    assert.equal(r.status, 204);
    assert.equal(r.headers.get('access-control-allow-origin'), 'http://example.test');
    assert.match(r.headers.get('access-control-allow-headers'), /authorization/);
  });

  test('a database failure is a 500 without its message', async (t) => {
    const logged = t.mock.method(console, 'error', () => {});
    const r = await api.call('GET', '/issues', undefined, ADMIN);
    assert.equal(logged.mock.callCount(), 1, 'the cause is logged on the server');
    assert.equal(r.status, 500);
    assert.deepEqual(r.body, { error: 'Internal server error' });
  });

  test('GET /login does not exist', async () => {
    assert.equal((await api.call('GET', '/login?username=a&password=b')).status, 401);
  });
});

const testDb = process.env.TEST_DB_NAME;
const skip = testDb ? false : 'set TEST_DB_NAME (and DB_*) to run the database tests; see README';

describe('database', { skip }, () => {
  let pool;
  let api;
  let admin; // the administrator's token
  before(async () => {
    if (testDb === process.env.DB_NAME) throw new Error('TEST_DB_NAME must not be DB_NAME: the tests drop its tables');
    pool = createPool(process.env, testDb);
    await migrate(pool, { fresh: true, adminPassword: 'admin password', log: () => {} });
    // A high sign-in limit here; the limit itself is tested on its own app.
    api = await serve(pool, { loginLimit: { windowMs: 60_000, limit: 100 } });
    const r = await api.call('POST', '/login', { username: 'superadmin', password: 'admin password' });
    assert.equal(r.status, 200);
    admin = r.body.token;
  });
  after(async () => {
    api?.server.close();
    await pool?.end();
  });

  const login = async (username, password) => api.call('POST', '/login', { username, password });

  test('signing in gives a token that works until it is signed out', async () => {
    const r = await login('superadmin', 'admin password');
    assert.equal(r.body.is_error, false);
    assert.match(r.body.token, /^[A-Za-z0-9_-]{43}$/);
    assert.ok(Date.parse(r.body.expires_at) > Date.now() + 7 * 3600 * 1000, 'about 8 hours');
    assert.equal(r.body.data[0].role, 'admin');
    assert.equal('password' in r.body.data[0], false);

    const [[stored]] = await pool.query('SELECT id FROM ir_sessions WHERE id = ?', [sha(r.body.token)]);
    assert.ok(stored, 'the server keeps only the hash of the token');

    assert.equal((await api.call('GET', '/status', undefined, r.body.token)).status, 200);
    assert.equal((await api.call('POST', '/logout', undefined, r.body.token)).status, 204);
    assert.equal((await api.call('GET', '/status', undefined, r.body.token)).status, 401);
  });

  test('an expired session is refused', async () => {
    const { body } = await login('superadmin', 'admin password');
    await pool.query('UPDATE ir_sessions SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE id = ?', [sha(body.token)]);
    assert.equal((await api.call('GET', '/status', undefined, body.token)).status, 401);
  });

  test('wrong or SQL-looking credentials answer 401', async () => {
    for (const [u, p] of [['superadmin', 'wrong password'], ['superadmin', "' OR '1'='1"], ["' OR '1'='1' -- ", 'x'], ['nobody', 'admin password']]) {
      const r = await login(u, p);
      assert.equal(r.status, 401, `${u} / ${p}`);
      assert.equal(r.body.is_error, true);
      assert.equal(r.body.token, undefined);
    }
  });

  test('a staff member works with informs but may not manage users (403)', async () => {
    assert.equal((await api.call('POST', '/users', { username: 'staff1', password: 'staff password', first_name: 'Mana' }, admin)).status, 200);
    const staff = (await login('staff1', 'staff password')).body;
    assert.equal(staff.data[0].role, 'staff');

    assert.equal((await api.call('POST', '/accessories', { name: 'Printer' }, staff.token)).status, 200);
    assert.equal((await api.call('POST', '/issues', { name: 'Paper jam' }, staff.token)).status, 200);
    const inform = await api.call('POST', '/informs', { user_id: staff.data[0].id, accessories_id: 1, issue_id: 1, customer_name: 'Somsri' }, staff.token);
    assert.equal(inform.status, 200);
    assert.equal((await api.call('GET', '/users', undefined, staff.token)).status, 200);

    assert.equal((await api.call('POST', '/users', { username: 'x', password: 'long enough pw' }, staff.token)).status, 403);
    assert.equal((await api.call('PUT', `/users/${staff.data[0].id}`, { username: 'staff1', role: 'admin' }, staff.token)).status, 403);
    assert.equal((await api.call('DELETE', '/users/1', undefined, staff.token)).status, 403);
  });

  test('a new password or role signs that user out everywhere', async () => {
    await api.call('POST', '/users', { username: 'moved', password: 'first password' }, admin);
    const s = (await login('moved', 'first password')).body;
    assert.equal((await api.call('GET', '/status', undefined, s.token)).status, 200);
    assert.equal((await api.call('PUT', `/users/${s.data[0].id}`, { username: 'moved', password: 'second password' }, admin)).status, 200);
    assert.equal((await api.call('GET', '/status', undefined, s.token)).status, 401);
    assert.equal((await login('moved', 'first password')).status, 401);
    assert.equal((await login('moved', 'second password')).status, 200);
  });

  test('deleting a user ends their sessions', async () => {
    await api.call('POST', '/users', { username: 'gone', password: 'gone password' }, admin);
    const s = (await login('gone', 'gone password')).body;
    assert.equal((await api.call('DELETE', `/users/${s.data[0].id}`, undefined, admin)).status, 200);
    assert.equal((await api.call('GET', '/status', undefined, s.token)).status, 401);
  });

  test('sign-ins are rate limited: after 3 failures even the right password waits (429)', async () => {
    const limited = await serve(pool, { loginLimit: { windowMs: 60_000, limit: 3 } });
    try {
      for (let i = 0; i < 3; i++) {
        assert.equal((await limited.call('POST', '/login', { username: 'superadmin', password: `wrong ${i}` })).status, 401);
      }
      const blocked = await limited.call('POST', '/login', { username: 'superadmin', password: 'admin password' });
      assert.equal(blocked.status, 429);
      assert.equal(blocked.body.is_error, true);
      assert.ok(blocked.headers.get('ratelimit-policy') || blocked.headers.get('ratelimit'), 'standard RateLimit headers');
    } finally {
      limited.server.close();
    }
    // Successful sign-ins do not count.
    const fresh = await serve(pool, { loginLimit: { windowMs: 60_000, limit: 2 } });
    try {
      for (let i = 0; i < 4; i++) {
        assert.equal((await fresh.call('POST', '/login', { username: 'superadmin', password: 'admin password' })).status, 200);
      }
    } finally {
      fresh.server.close();
    }
  });

  test('lookup tables: create, list with paging, read, update, delete', async () => {
    await pool.query('DELETE FROM ir_accessories');
    await pool.query('ALTER TABLE ir_accessories AUTO_INCREMENT = 1');
    for (const name of ['Printer', 'Laptop', 'Router']) {
      assert.equal((await api.call('POST', '/accessories', { name }, admin)).status, 200);
    }
    const page = await api.call('GET', '/accessories?take=2&skip=1', undefined, admin);
    assert.equal(page.body.total, 3);
    assert.deepEqual(page.body.data.map((a) => a.name), ['Laptop', 'Router']);
    assert.equal((await api.call('GET', '/accessories?take=null&skip=null', undefined, admin)).body.length, 3);

    assert.equal((await api.call('PUT', '/accessories/2', { name: 'Notebook' }, admin)).status, 200);
    assert.equal((await api.call('GET', '/accessories/2', undefined, admin)).body[0].name, 'Notebook');
    assert.equal((await api.call('DELETE', '/accessories/2', undefined, admin)).status, 200);
    assert.deepEqual((await api.call('GET', '/accessories/2', undefined, admin)).body, []);
    assert.equal((await api.call('DELETE', '/accessories/2', undefined, admin)).status, 404);
    assert.equal((await api.call('PUT', '/accessories/2', { name: 'x' }, admin)).status, 404);
  });

  test('migrate seeded the three Thai statuses', async () => {
    const r = await api.call('GET', '/status', undefined, admin);
    assert.deepEqual(r.body.map((s) => s.name), ['รอตรวจสอบ', 'อยู่ระหว่างดำเนินการ', 'สำเร็จ']);
  });

  test('text that would rewrite unparameterized SQL is stored as typed', async () => {
    const evil = "x'); DELETE FROM ir_issues; --";
    await api.call('POST', '/issues', { name: evil }, admin);
    const names = (await api.call('GET', '/issues', undefined, admin)).body.map((i) => i.name);
    assert.ok(names.includes(evil));
    assert.ok(names.includes('Paper jam'), 'other rows are still there');
  });

  test('users: password hashed and never returned; usernames unique', async () => {
    const [[row]] = await pool.query("SELECT password FROM ir_users WHERE username = 'staff1'");
    assert.match(row.password, /^scrypt\$/);
    const list = await api.call('GET', '/users', undefined, admin);
    assert.ok(!list.body.some((u) => u.id === 1), 'user 1 (superadmin) is left out');
    for (const u of list.body) assert.equal('password' in u, false);
    assert.equal('password' in (await api.call('GET', '/users/1', undefined, admin)).body[0], false);
    assert.equal((await api.call('POST', '/users', { username: 'staff1', password: 'another password' }, admin)).status, 409);
  });

  test('informs: filter by customer with a matching total, update, joins', async () => {
    const base = { user_id: 1, accessories_id: 1, issue_id: 1, datetime_inform: '2026-11-25 09:30:00' };
    for (const customer_name of ['Somsri 100%', 'Somsri 1000', 'Mana']) {
      assert.equal((await api.call('POST', '/informs', { ...base, customer_name, detail: 'ไม่ติด' }, admin)).status, 200);
    }
    const filtered = await api.call('GET', `/informs?filter=${encodeURIComponent('100%')}&take=10&skip=0`, undefined, admin);
    assert.equal(filtered.body.total, 1, '% is a character here, not a wildcard');
    assert.equal(filtered.body.data[0].customer_name, 'Somsri 100%');

    const [[{ id }]] = await pool.query("SELECT id FROM ir_informs WHERE customer_name = 'Mana'");
    const upd = await api.call('PUT', `/informs/${id}`, { status_id: 3, user_id_operator: 1, datetime_success: '2026-11-26 10:00:00', cause_solution: 'เปลี่ยนสาย' }, admin);
    assert.equal(upd.status, 200);
    const one = (await api.call('GET', '/informs?take=1&skip=0', undefined, admin)).body.data[0];
    assert.equal(one.customer_name, 'Mana', 'newest first');
    assert.equal(one.status_name, 'สำเร็จ');
    assert.equal(one.user_name_operator, 'Super Admin');
    assert.equal(one.datetime_success, '2026-11-26 10:00:00');
  });
});
