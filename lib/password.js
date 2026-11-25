import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// scrypt settings (Node's defaults, written into each hash so they can grow).
const N = 16384;
const r = 8;
const p = 1;
const keyLength = 32;

// hashPassword returns "scrypt$N$r$p$salt$hash" (salt and hash in base64).
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, keyLength, { N, r, p });
  return ['scrypt', N, r, p, salt.toString('base64'), hash.toString('base64')].join('$');
}

// verifyPassword says whether password matches a hash from hashPassword.
export async function verifyPassword(password, stored) {
  const parts = typeof stored === 'string' ? stored.split('$') : [];
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, rr, pp, salt, hash] = parts;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(n), r: Number(rr), p: Number(pp),
  });
  return timingSafeEqual(actual, expected);
}

// A hash of nothing in particular, checked when the username is unknown so
// that answer takes as long as a wrong password.
export const dummyHash = await hashPassword(randomBytes(16).toString('hex'));
