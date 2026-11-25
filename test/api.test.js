// The API end to end. The tests marked "database" run against the MySQL
// database named by TEST_DB_NAME (with DB_HOST / DB_PORT / DB_USER /
// DB_PASSWORD) and DROP AND REMAKE its tables; without TEST_DB_NAME they are
// skipped. The others never reach a database.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../app.js';
import { createPool } from '../connect_db.js';
import { migrate } from '../migrate/db.js';

async function serve(pool) {
  const server = createApp(pool, { corsOrigin: 'http://example.test' }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  };
  return { server, call };
}

describe('without a database', () => {
  // Any query fails the test: these requests must be refused before SQL.
  const pool = { query: async () => { throw new Error('the database was reached'); } };
  let api;
  before(async () => { api = await serve(pool); });
  after(() => api.server.close());

  test('bad ids and paging are refused with 400', async () => {
    for (const path of ['/accessories/abc', '/users/0', '/informs/1%20OR%201=1', '/status?take=x', '/issues?take=-1']) {
      const r = await api.call('GET', path);
      assert.equal(r.status, 400, path);
      assert.ok(r.body.error, path);
    }
  });

  test('bad bodies are refused with 400', async () => {
    const cases = [
      ['POST', '/accessories', {}],
      ['POST', '/status', { name: 'x'.repeat(256) }],
      ['POST', '/users', { username: 'a', password: 'short' }],
      ['POST', '/informs', { user_id: 1, issue_id: 1 }],
      ['PUT', '/informs/1', { status_id: 'two' }],
    ];
    for (const [method, path, body] of cases) {
      const r = await api.call(method, path, body);
      assert.equal(r.status, 400, `${method} ${path}`);
    }
  });

  test('a broken JSON body is a 400, an unknown path a 404', async () => {
    const res = await fetch(`http://127.0.0.1:${api.server.address().port}/issues`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
    });
    assert.equal(res.status, 400);
    assert.equal((await api.call('GET', '/nothing')).status, 404);
  });

  test('CORS allows the configured origin and answers preflight', async () => {
    const r = await api.call('OPTIONS', '/users');
    assert.equal(r.status, 204);
    assert.equal(r.headers.get('access-control-allow-origin'), 'http://example.test');
  });

  test('a database failure is a 500 without its message', async (t) => {
    const logged = t.mock.method(console, 'error', () => {});
    const r = await api.call('GET', '/issues');
    assert.equal(logged.mock.callCount(), 1, 'the cause is logged on the server');
    assert.equal(r.status, 500);
    assert.deepEqual(r.body, { error: 'Internal server error' });
  });

  test('GET /login no longer exists', async () => {
    assert.equal((await api.call('GET', '/login?username=a&password=b')).status, 404);
  });
});

const testDb = process.env.TEST_DB_NAME;
const skip = testDb ? false : 'set TEST_DB_NAME (and DB_*) to run the database tests; see README';

describe('database', { skip }, () => {
  let pool;
  let api;
  before(async () => {
    if (testDb === process.env.DB_NAME) throw new Error('TEST_DB_NAME must not be DB_NAME: the tests drop its tables');
    pool = createPool(process.env, testDb);
    await migrate(pool, { fresh: true, adminPassword: 'admin password', log: () => {} });
    api = await serve(pool);
  });
  after(async () => {
    api?.server.close();
    await pool?.end();
  });

  test('lookup tables: create, list with paging, read, update, delete', async () => {
    for (const name of ['Printer', 'Laptop', 'Router']) {
      assert.equal((await api.call('POST', '/accessories', { name })).status, 200);
    }
    const page = await api.call('GET', '/accessories?take=2&skip=1');
    assert.equal(page.body.total, 3);
    assert.deepEqual(page.body.data.map((a) => a.name), ['Laptop', 'Router']);
    assert.equal((await api.call('GET', '/accessories?take=null&skip=null')).body.length, 3);

    assert.equal((await api.call('PUT', '/accessories/2', { name: 'Notebook' })).status, 200);
    assert.equal((await api.call('GET', '/accessories/2')).body[0].name, 'Notebook');
    assert.equal((await api.call('DELETE', '/accessories/2')).status, 200);
    assert.deepEqual((await api.call('GET', '/accessories/2')).body, []);
    assert.equal((await api.call('DELETE', '/accessories/2')).status, 404);
    assert.equal((await api.call('PUT', '/accessories/2', { name: 'x' })).status, 404);
  });

  test('migrate seeded the three Thai statuses', async () => {
    const r = await api.call('GET', '/status');
    assert.deepEqual(r.body.map((s) => s.name), ['รอตรวจสอบ', 'อยู่ระหว่างดำเนินการ', 'สำเร็จ']);
  });

  test('text that would rewrite unparameterized SQL is stored as typed', async () => {
    const evil = "x'); DELETE FROM ir_issues; --";
    await api.call('POST', '/issues', { name: 'Screen' });
    await api.call('POST', '/issues', { name: evil });
    const r = await api.call('GET', '/issues');
    assert.deepEqual(r.body.map((i) => i.name), ['Screen', evil]);
  });

  test('users: password hashed, never returned, login by POST', async () => {
    const created = await api.call('POST', '/users', {
      first_name: 'Som Chai', last_name: 'Jaidee', username: 'somchai', password: 'long enough pw', email: 's@example.test',
    });
    assert.equal(created.status, 200);

    const [[row]] = await pool.query("SELECT password FROM ir_users WHERE username = 'somchai'");
    assert.match(row.password, /^scrypt\$/);

    const list = await api.call('GET', '/users');
    assert.deepEqual(list.body.map((u) => u.username), ['somchai'], 'user 1 (superadmin) is left out');
    assert.equal(list.body[0].fullname, 'Som Chai Jaidee', 'spaces in names are kept');
    for (const u of list.body) assert.equal('password' in u, false);
    assert.equal('password' in (await api.call('GET', '/users/1')).body[0], false);

    const ok = await api.call('POST', '/login', { username: 'somchai', password: 'long enough pw' });
    assert.equal(ok.body.is_error, false);
    assert.equal(ok.body.data[0].username, 'somchai');
    assert.equal('password' in ok.body.data[0], false);

    for (const attempt of [
      { username: 'somchai', password: 'wrong password' },
      { username: 'somchai', password: "' OR '1'='1" },
      { username: "' OR '1'='1' -- ", password: 'x' },
      { username: 'nobody', password: 'long enough pw' },
    ]) {
      assert.equal((await api.call('POST', '/login', attempt)).body.is_error, true, JSON.stringify(attempt));
    }

    assert.equal((await api.call('POST', '/login', { username: 'superadmin', password: 'admin password' })).body.is_error, false);
    assert.equal((await api.call('POST', '/users', { username: 'somchai', password: 'another password' })).status, 409);
  });

  test('PUT /users keeps the password when none is sent', async () => {
    await api.call('POST', '/users', { username: 'keep', password: 'first password' });
    const [[{ id }]] = await pool.query("SELECT id FROM ir_users WHERE username = 'keep'");
    assert.equal((await api.call('PUT', `/users/${id}`, { username: 'keep', display_name: 'K' })).status, 200);
    assert.equal((await api.call('POST', '/login', { username: 'keep', password: 'first password' })).body.is_error, false);
    assert.equal((await api.call('PUT', `/users/${id}`, { username: 'keep', password: 'second password' })).status, 200);
    assert.equal((await api.call('POST', '/login', { username: 'keep', password: 'first password' })).body.is_error, true);
    assert.equal((await api.call('POST', '/login', { username: 'keep', password: 'second password' })).body.is_error, false);
  });

  test('informs: create, filter by customer with a matching total, update, joins', async () => {
    const base = { user_id: 1, accessories_id: 1, issue_id: 1, datetime_inform: '2026-11-25 09:30:00' };
    for (const customer_name of ['Somsri 100%', 'Somsri 1000', 'Mana']) {
      assert.equal((await api.call('POST', '/informs', { ...base, customer_name, detail: 'ไม่ติด' })).status, 200);
    }
    const filtered = await api.call('GET', `/informs?filter=${encodeURIComponent('100%')}&take=10&skip=0`);
    assert.equal(filtered.body.total, 1, '% is a character here, not a wildcard');
    assert.equal(filtered.body.data[0].customer_name, 'Somsri 100%');

    const all = await api.call('GET', '/informs?filter=null&take=2&skip=0');
    assert.equal(all.body.total, 3);
    assert.deepEqual(all.body.data.map((i) => i.customer_name), ['Mana', 'Somsri 1000'], 'newest first');

    const upd = await api.call('PUT', '/informs/1', { status_id: 3, user_id_operator: 1, datetime_success: '2026-11-26 10:00:00', cause_solution: 'เปลี่ยนสาย' });
    assert.equal(upd.status, 200);
    const one = (await api.call('GET', '/informs?take=10&skip=2')).body.data[0];
    assert.equal(one.status_name, 'สำเร็จ');
    assert.equal(one.user_name_operator, 'Super Admin');
    assert.equal(one.datetime_success, '2026-11-26 10:00:00');
  });
});
