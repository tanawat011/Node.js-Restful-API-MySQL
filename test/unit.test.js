import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HttpError, fields, idParam, paging } from '../lib/http.js';
import { hashPassword, verifyPassword } from '../lib/password.js';

test('a password hash checks the right password and only it', async () => {
  const hash = await hashPassword('correct horse');
  assert.match(hash, /^scrypt\$16384\$8\$1\$/);
  assert.equal(await verifyPassword('correct horse', hash), true);
  assert.equal(await verifyPassword('correct hors', hash), false);
  assert.notEqual(await hashPassword('correct horse'), hash, 'each hash has its own salt');
  assert.equal(await verifyPassword('x', 'plain-text-from-2018'), false);
});

test('paging reads take / skip as the client sends them', () => {
  assert.equal(paging({}), null);
  assert.equal(paging({ take: 'null', skip: 'null' }), null);
  assert.deepEqual(paging({ take: '10', skip: '20' }), { take: 10, skip: 20 });
  assert.deepEqual(paging({ take: '5' }), { take: 5, skip: 0 });
  for (const take of ['-1', '1.5', '5 OR 1=1', '1e3x']) {
    assert.throws(() => paging({ take }), HttpError, take);
  }
});

test('idParam takes only positive whole numbers', () => {
  assert.equal(idParam({ params: { id: '42' } }), 42);
  for (const id of ['0', '-3', '1 OR 1=1', 'abc', '2.5']) {
    assert.throws(() => idParam({ params: { id } }), { status: 400 }, id);
  }
});

test('fields keeps only the fields of the spec and checks each', () => {
  const spec = { name: { type: 'string', required: true }, n: { type: 'int' }, at: { type: 'datetime' } };
  assert.deepEqual(fields({ name: 'a', n: '3', extra: 'dropped' }, spec), { name: 'a', n: 3 });
  assert.deepEqual(fields({ name: 'a', n: null }, spec), { name: 'a', n: null });
  assert.throws(() => fields({}, spec), /name is required/);
  assert.throws(() => fields({ name: 'ก'.repeat(256) }, spec), /longer than 255/);
  assert.doesNotThrow(() => fields({ name: 'ก'.repeat(255) }, spec));
  assert.throws(() => fields({ name: 'a', n: 0 }, spec), /positive whole number/);
  assert.throws(() => fields({ name: 'a', at: 'tomorrow' }, spec), /date and time/);
  assert.throws(() => fields({ name: { $gt: '' } }, spec), /must be text/);
  assert.throws(() => fields([], spec), /JSON object/);
});
