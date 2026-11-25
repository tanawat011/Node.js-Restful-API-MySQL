// Small helpers shared by the routes.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// The :id of a route, as a positive whole number.
export function idParam(req) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, 'id must be a positive whole number');
  return id;
}

function count(value, name) {
  if (value === undefined || value === '' || value === 'null') return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new HttpError(400, `${name} must be a whole number`);
  return n;
}

// take / skip as the Angular client sends them: numbers, or "null" for
// "every row". Returns null when no page was asked for.
export function paging(query) {
  const take = count(query.take, 'take');
  const skip = count(query.skip, 'skip') ?? 0;
  return take === null ? null : { take, skip };
}

// fields(body, spec) checks the request body against spec and returns only
// the fields named there. spec: { name: { type, required } }, type one of
// 'string' (<= 255 characters), 'text', 'int' (positive), 'datetime'.
export function fields(body, spec, { partial = false } = {}) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'body must be a JSON object');
  }
  const out = {};
  for (const [name, { type, required }] of Object.entries(spec)) {
    const value = body[name];
    if (value === undefined || value === null || value === '') {
      if (required && !partial) throw new HttpError(400, `${name} is required`);
      if (value !== undefined) out[name] = null;
      continue;
    }
    switch (type) {
      case 'string':
      case 'text':
        if (typeof value !== 'string' && typeof value !== 'number') throw new HttpError(400, `${name} must be text`);
        if (type === 'string' && [...String(value)].length > 255) throw new HttpError(400, `${name} is longer than 255 characters`);
        out[name] = String(value);
        break;
      case 'int': {
        const n = Number(value);
        if (!Number.isSafeInteger(n) || n < 1) throw new HttpError(400, `${name} must be a positive whole number`);
        out[name] = n;
        break;
      }
      case 'datetime':
        if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new HttpError(400, `${name} must be a date and time`);
        out[name] = value;
        break;
      default:
        throw new Error(`unknown type ${type}`);
    }
  }
  return out;
}

// A list answer: every row, or { data, total } when a page was asked for.
export async function list(pool, { select, from, where = '', params = [], order = 'ORDER BY id' }, page) {
  if (!page) {
    const [rows] = await pool.query(`SELECT ${select} FROM ${from} ${where} ${order}`, params);
    return rows;
  }
  const [rows] = await pool.query(`SELECT ${select} FROM ${from} ${where} ${order} LIMIT ? OFFSET ?`, [...params, page.take, page.skip]);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ${from} ${where}`, params);
  return { data: rows, total };
}
