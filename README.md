# CampusSlot

A complete MERN campus equipment reservation platform. Students discover equipment and submit requests; staff approve requests, hand over equipment, record returns, and track overdue loans. React + Vite, Express + Node.js, MongoDB Atlas, GitHub, and Render.

## Run locally with Atlas

Requires Node.js 22.12+ (or 24) and a MongoDB Atlas cluster.

```powershell
npm ci
Copy-Item server/.env.example server/.env
# Edit server/.env with your Atlas URI. URL-encode special characters in credentials.
npm run seed
npm run create-staff
npm run dev
```

Open http://localhost:5173. API runs on port 4000, with Vite proxying `/api`. Register a student through the UI. Create staff only through the interactive CLI; it hides the password, requires confirmation, and refuses to promote or overwrite existing accounts. No default passwords are shipped.

Atlas setup: create a dedicated database user with `readWrite` access to the `campusslot` database, allow the development machine's IP in Atlas Network Access, and put the Atlas `mongodb+srv://` URI in `server/.env`. Keep this file private. Production explicitly requires an Atlas SRV URI; the application never falls back to local or in-memory storage.

`npm run seed` inserts six equipment items by unique asset tag without deleting or changing existing equipment, users, reservations, or histories. Each equipment document represents **one physical item**.

## Features

- Public equipment search matches name, description, and pickup location. Category filtering, kit contents/specs, and reserved windows are shown without borrower identities or project details.
- Student registration, login, logout, private reservations, cancellation, and private activity history.
- Reservations require a 10–1,000 character project purpose. Pickup must be in the future; both endpoints must fall within the next 90 × 24 hours. Duration is at most seven × 24 hours.
- At most three active reservations per student. Active means pending, approved, or checked out, including uncollected requests that have passed their window. Students can cancel pending/approved requests; staff can reject expired pending requests. These states are deliberately not silently changed by a background job.
- Pending requests hold slots. Overlap uses half-open intervals: `existing.start < requested.end && existing.end > requested.start`. Adjacent bookings are allowed.
- Staff search by student name/email, equipment name/asset tag, or project purpose. Filter by lifecycle status or overdue. Counts reflect all accessible reservations, independent of search filters; lists are paginated.
- Approve/reject pending requests. Approvals fail at or after pickup time. Staff can add optional notes.
- Checkout requires approved status and `start <= now < end`. A previous borrower must physically return an item before another checkout, even if that previous borrower's booked window ended.
- Returns close checked-out loans. Overdue means still checked out and past the scheduled return time.
- Append-only activity via the API for creation, approval, rejection, cancellation, checkout, and return. Staff see all events; students see only their own. Staff notes are visible to the borrower.
- Responsive layouts, keyboard navigation, focus-trapped dialogs, local timezone labels, pending/error/empty states, and confirmation dialogs for lifecycle actions.

## Transaction and security design

All reservation creation and lifecycle changes use MongoDB transactions with snapshot reads and majority writes. Each transaction increments the borrowing student's `revision` and then the equipment's `revision` before checking invariants. Concurrent writers conflict on these documents and the driver retries the transaction against a fresh snapshot. This prevents write-skew double bookings and student-limit bypasses across different items. A partial unique index provides an additional guard of one checked-out reservation per physical item.

Reservation changes and their activity events commit together or roll back together. There are no direct lifecycle update endpoints that bypass this service. Database schemas and indexes initialize before the server starts; startup refuses a MongoDB deployment without transaction support.

Passwords are bcrypt-hashed with cost 12 and limited to 72 UTF-8 bytes to prevent silent bcrypt truncation. Public registration rejects unknown fields and always creates students. Random 256-bit session tokens are stored as SHA-256 hashes in MongoDB, expire after seven days, and are revoked on logout. Cookies use HttpOnly, SameSite=Lax, and Secure in production. The API loads the current role from MongoDB for every authenticated request.

Unsafe API requests require an `Origin` header exactly matching `APP_ORIGIN`; this provides CSRF protection alongside SameSite cookies. No cross-origin credential sharing is enabled. Helmet security headers, bounded JSON bodies, strict Zod validation, escaped search expressions, auth rate limits, generic login errors, and generic unexpected server errors are included. Account recovery and email verification are outside the requested scope.

## Verify

```powershell
npm test
npm run build
```

The 14 integration tests launch a disposable **real MongoDB replica set** using `mongodb-memory-server`. They exercise the actual Express API, MongoDB queries, transactions, indexes, cookies, authorization, and concurrent requests. The first test run may download a MongoDB binary. This database is only for automated tests; production and normal development require Atlas. Tests do not read or modify your Atlas database.

Coverage includes authentication, attempted staff self-registration, ownership isolation, public data privacy, search/filtering, every date rule, adjacency, pending slot holds, cancellation release, active limits, competing overlapping requests, simultaneous requests across different items, review rules, checkout windows, overdue physical conflicts, return counts, legal concurrent transitions, and transaction rollback when activity storage fails. GitHub Actions runs tests and the production build on pushes and pull requests.

## Deploy to Render

The repository includes a Render Blueprint in `render.yaml`. It deploys **one Node web service**: Express serves `/api` and Vite's compiled static assets from the same origin. No separate frontend host is required.

1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint**, connect the repository, and select `render.yaml`. Alternatively create a Node web service with build command `npm ci && npm run build`, start command `npm start`, and health path `/api/health`.
3. Set `MONGODB_URI` to your Atlas URI and `NODE_ENV=production`. The app uses Render's `RENDER_EXTERNAL_URL` as its allowed origin automatically. If you add a custom domain, set `APP_ORIGIN` to its exact canonical HTTPS origin **without a trailing slash**, and use that domain consistently.
4. In Atlas Network Access, allow the outbound IP ranges shown for this Render service. Keep the database user scoped to the application database.
5. The Blueprint starts with `npm run seed && npm start`, ensuring the six equipment items exist in Atlas. Seeding is idempotent and never resets existing records or accounts. Create staff from your local terminal against the **same Atlas database**, using `npm run create-staff`. Staff creation is never run automatically during deployment.
6. Deploy, then confirm `/api/health` returns `{ "status": "ok" }`. Register a student and test request → approval → checkout during the booked window → return → activity history.

Render binds the application to `0.0.0.0` using its provided `PORT`. Only one trusted reverse proxy is configured in production. Shutdown closes HTTP connections and MongoDB cleanly. If you scale to multiple application instances, use a shared rate-limit store; reservation correctness already relies on MongoDB and remains safe across instances.

Deployment references: [Render Express guide](https://render.com/docs/deploy-node-express-app), [Render web services](https://render.com/docs/web-services), [Mongoose transaction API](<https://mongoosejs.com/docs/api/connection.html#Connection.prototype.transaction()>).

## API reference

All responses are JSON. Errors use `{ "error": "human-readable message" }`. Mutating requests use `Content-Type: application/json` and the configured `Origin`. Authentication uses the session cookie, not localStorage.

| Method | Endpoint                              | Access / input                                                                 |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------ |
| GET    | `/api/health`                         | Public readiness                                                               |
| GET    | `/api/equipment?q=&category=`         | Public catalog and reserved windows                                            |
| POST   | `/api/auth/register`                  | `{ name, email, password }`, student only                                      |
| POST   | `/api/auth/login`                     | `{ email, password }`                                                          |
| POST   | `/api/auth/logout`                    | Revokes current session                                                        |
| GET    | `/api/auth/me`                        | Current authenticated user                                                     |
| POST   | `/api/reservations`                   | Student: `{ equipment, purpose, start, end }`; ISO-8601 timestamps with offset |
| GET    | `/api/reservations?q=&status=&page=1` | Students: own; staff: all; 20 per page                                         |
| POST   | `/api/reservations/:id/cancel`        | Owner or staff; pending/approved                                               |
| POST   | `/api/reservations/:id/approve`       | Staff; `{ note? }`                                                             |
| POST   | `/api/reservations/:id/reject`        | Staff; `{ note? }`                                                             |
| POST   | `/api/reservations/:id/checkout`      | Staff; `{ note? }`                                                             |
| POST   | `/api/reservations/:id/return`        | Staff; `{ note? }`                                                             |
| GET    | `/api/activity?page=1&reservation=`   | Students: own; staff: all; 30 per page                                         |

Status values: `pending`, `approved`, `checked_out`, `returned`, `rejected`, `cancelled`; reservation filtering also accepts `overdue`. Use `{}` as the body for actions without notes.

## Project structure

```text
client/src/              React interface, API client, responsive styles
server/src/app.js       Express API, sessions, authorization, search
server/src/models.js    MongoDB schemas and indexes
server/src/reservations.js  Transactional reservation lifecycle
server/src/validation.js    Input and time-window rules
server/scripts/         Non-destructive seed and secure staff creation
server/test/            Real MongoDB integration tests
.github/workflows/      CI
render.yaml             Render deployment blueprint
```

No Atlas credentials, staff credentials, or deployment keys belong in Git. `server/.env.example` documents the required configuration.
