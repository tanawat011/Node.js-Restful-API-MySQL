# Node.js RESTful API + MySQL (beginner project)

The back end of a small **Inform Repair System**: staff log repair jobs
("informs") for a customer's device, an operator takes them, and each job
moves through three statuses — รอตรวจสอบ (waiting), อยู่ระหว่างดำเนินการ
(in progress), สำเร็จ (done). It was written for an Angular client on
`localhost:4200`, which is not in this repository.

Originally written in 2018 while learning Node.js, Express and MySQL;
refreshed in Nov 2026: Node 24+, Express 5, mysql2, ES modules, every value
sent to MySQL as a parameter (the 2018 code built SQL from request text),
hashed passwords, sign-in sessions on every route, settings in environment
variables, tests and CI.

## Signing in

Every route except `POST /login` needs a session:

1. `POST /login` with `{ "username": "...", "password": "..." }` answers
   `{ data: [user], is_error: false, token, expires_at }` (401 and
   `is_error: true` when the name or password is wrong).
2. Send `Authorization: Bearer <token>` with every other request. Without
   it, or with an ended one, the answer is **401**.
3. `POST /logout` ends the session at once.

The token is 32 random bytes; the server stores only its SHA-256 in
`ir_sessions`, with the user and an expiry (`SESSION_TTL_HOURS`, 8 by
default). A server-side session was chosen over JWT access + refresh tokens
because it is simpler and just as sound here: no signing key to guard or
rotate, no refresh flow, and signing out (or a new password, or removing
the user) ends the session immediately.

Users have a role: `admin` or `staff`. Staff do the repair work (informs,
accessories, issues, statuses) and can read the user list; adding, editing
and removing users is for an administrator — staff get **403**.

Failed sign-ins are rate limited per client address: after 5 in 15 minutes
`POST /login` answers **429** until the window passes. (Behind a reverse
proxy, set Express's `trust proxy` so the real address is used.)

## Endpoints

| Resource | Routes |
|---|---|
| `/accessories`, `/issues`, `/status` | `GET /` (all, or `?take=10&skip=0` → `{ data, total }`), `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id` |
| `/users` | same; `POST` / `PUT` / `DELETE` for administrators only; passwords are stored as scrypt hashes and never returned; the list leaves out user 1 (the administrator) |
| `/informs` | same, plus `?filter=` on the customer's name; the list joins issue, status, user and accessory names |
| `/login`, `/logout` | see above |

Changed from 2018 for safety: login was `GET /login?username=&password=`
(the password ended up in URLs and logs) and is now a `POST`.

## Quick start

Needs Node.js 24+ and Docker (for MySQL).

```sh
git clone https://github.com/tanawat011/Node.js-Restful-API-MySQL.git
cd Node.js-Restful-API-MySQL
cp .env.example .env          # dev-only placeholders; change them if you like
docker compose up -d --wait   # MySQL 8.4 on 127.0.0.1:13307
npm ci
npm run migrate               # tables + statuses + user superadmin (SEED_ADMIN_PASSWORD)
npm start                     # http://127.0.0.1:3000

curl -X POST localhost:3000/login -H 'content-type: application/json' \
  -d '{"username":"superadmin","password":"change-me-admin-dev-only"}'
# → {"data":[...],"is_error":false,"token":"...","expires_at":"..."}
curl localhost:3000/status -H "Authorization: Bearer <token>"
```

`npm run migrate` keeps existing data; `npm run migrate -- --fresh` drops
the five tables first. `docker compose down -v` deletes the database.

## Tests

```sh
npm test    # with .env from above: every test; without TEST_DB_NAME the database tests are skipped
```

The database tests use `TEST_DB_NAME` (compose creates `inform_repair_test`)
and drop and remake its tables; they refuse to run against `DB_NAME`.
CI runs `npm audit` and every test against a MySQL 8.4 service on Node 24
and 26 (and fails if any was skipped).
