# Zenith ERP — Full-Stack Boilerplate

A clean, minimal, reviewer-defensible full-stack foundation for a 24-hour hackathon. It proves
frontend ↔ backend ↔ local PostgreSQL end-to-end and ships eight reusable engineering-pattern
skeletons ready to extend to **any** operational ERP domain (assets, fleet, ESG, POS,
procurement, booking) by **renaming and adding — never deleting**.

`Item` is a deliberate placeholder entity. It exists to prove the pipe and host the pattern
examples; tomorrow it is renamed to the real domain entity.

---

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19 + Vite 6, JavaScript, Tailwind CSS 3.4, shadcn/ui (Radix), React Router 7, axios, react-hook-form, react-hot-toast, lucide-react, date-fns. Recharts installed, unused. Vitest. |
| Backend | Node 18+, Express 5, ES modules, Prisma 6, express-validator, jsonwebtoken, bcryptjs, helmet, cors, morgan, express-rate-limit, dotenv. PDFKit + Nodemailer installed, unused. Supertest + Vitest. |
| Database | PostgreSQL 18, local. No hosted anything. No `directUrl` (local needs no pooler split). |
| Repo | One repo, `/client` + `/server` + `/docs`, npm, root `concurrently` scripts. No Docker, no workspaces. |

## Architecture at a glance

```
Browser ──axios(+Bearer)──▶ Express 5 ──Prisma 6──▶ PostgreSQL 18 (local)
   ▲            │                  │
   │            │                  ├─ authMiddleware → requireRole → ownership scope (3-layer RBAC)
   │            │                  ├─ express-validator (whitelist / mass-assignment defence)
   │            │                  ├─ withTransaction (atomic multi-write)
   │            │                  ├─ state-machine guard (legal status transitions)
   │            │                  ├─ notificationService + activityLog (persistent + audit)
   │            │                  └─ DB constraints: EXCLUDE (no-overlap), partial unique index
   └────────────┘  { success, message, data, meta } envelope on every response
```

**Why `app.js` / `server.js` are separate:** `app.js` exports the Express app without binding a
port, so Supertest drives it in-process. `server.js` owns the port and graceful shutdown.

## Folder tree

```
zenith-erp/
├── client/                     React 19 + Vite SPA
│   ├── src/
│   │   ├── api/                axios instance (Bearer + auto-logout) + endpoint modules
│   │   ├── components/ui/      shadcn primitives (source, not a dependency)
│   │   ├── components/common/  StatusBadge, Loading, ErrorState, EmptyState, NotificationBell
│   │   ├── context/            AuthContext (no Redux — Context is right-sized here)
│   │   ├── layouts/            PublicLayout, AppShell (role-aware sidebar)
│   │   ├── pages/              Landing, Login, Register, Items, SystemStatus, NotFound
│   │   ├── routes/             ProtectedRoute
│   │   └── styles/tokens.css   ← the entire palette. Swap here to re-theme in minutes.
│   └── ...
├── server/                     Express 5 + Prisma 6 API
│   ├── prisma/
│   │   ├── schema.prisma       User, Item, Notification, ActivityLog, BookingSlot + enums
│   │   ├── migrations/         001_init (generated) + 002_concurrency_primitives (hand-written)
│   │   └── seed.js             idempotent demo users + items
│   └── src/
│       ├── config/             env (boot-time validation), prisma (single client)
│       ├── middleware/         auth, requireRole, validate, rateLimit, errorHandler, notFound
│       ├── lib/                jwt, apiResponse, prismaErrors, withTransaction, activityLog
│       └── modules/            auth, items, notifications, health
└── docs/                       api-contract.md, hackathon-checklist.md, shadcn-setup.md
```

---

## Windows setup

Prerequisites: **Node 18+**, **npm**, **Git**, and **PostgreSQL 18 running locally**.

> On this machine `psql` is **not on PATH** — it lives at
> `C:\PostgreSQL Download File\bin\psql.exe`. Quote the full path when you need it. You do not
> need `psql` for normal development; Prisma talks to the DB directly.

### 1. Local PostgreSQL preparation (one-time)

The app connects as a role `zenith` to a database `transitops_dev`. If they don't exist yet,
create them as a superuser (you'll be prompted for the `postgres` password):

```powershell
& "C:\PostgreSQL Download File\bin\psql.exe" -U postgres -h localhost -c "CREATE ROLE zenith LOGIN PASSWORD 'zenith_dev';"
& "C:\PostgreSQL Download File\bin\psql.exe" -U postgres -h localhost -c "CREATE DATABASE transitops_dev OWNER zenith;"
```

Prisma's `migrate dev` needs to create a temporary **shadow database** to detect drift, which
requires the `CREATEDB` privilege on the role:

```powershell
& "C:\PostgreSQL Download File\bin\psql.exe" -U postgres -h localhost -c "ALTER ROLE zenith CREATEDB;"
```

> `CREATEDB` lets the role create/drop databases (the shadow DB, and a reset if you ever run
> one). It is **not** superuser — it can't read other roles' data. It is the minimum privilege
> `migrate dev` needs. See `docs/hackathon-checklist.md` and the drift note in migration 002.

### 2. Environment files

`.env` files hold secrets and are **gitignored**. Create them from the examples:

```powershell
Copy-Item server\.env.example server\.env
Copy-Item client\.env.example client\.env
```

Generate a real JWT secret and paste it into `server\.env`:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`server/.env` must have (at minimum):
```
DATABASE_URL="postgresql://zenith:zenith_dev@localhost:5432/transitops_dev"
JWT_SECRET="<the generated hex string>"
```
The server **refuses to start** with a clear message if `DATABASE_URL` or `JWT_SECRET` is missing.

### 3. Install

```powershell
npm run install:all      # installs server + client (no root node_modules bloat)
```

### 4. Database: generate, migrate, seed

```powershell
npm run db:generate      # prisma generate — build the typed client
npm run db:migrate       # apply migrations 001 + 002 to transitops_dev
npm run db:seed          # idempotent demo users + items (safe to re-run)
```

### 5. Run

```powershell
npm run dev              # both apps: API on :5000, client on :5173
```

Open **http://localhost:5173**, click a demo account on the landing page, log in.

---

## Demo credentials (seeded)

| Role | Email | Password |
| --- | --- | --- |
| ADMIN | `admin@zenith.dev` | `admin12345` |
| EMPLOYEE | `employee@zenith.dev` | `employee12345` |

These are public, weak, committed demo logins — **not secrets**. They are defined once in
`client/src/lib/demo-credentials.js` and must match `server/prisma/seed.js`.

---

## Scripts

**Root**
| Script | Does |
| --- | --- |
| `npm run dev` | Both apps via concurrently |
| `npm run dev:server` / `dev:client` | One app |
| `npm run install:all` | Install both |
| `npm run build` | Build the client |
| `npm run test` | Test both apps |
| `npm run db:generate` / `db:migrate` / `db:seed` / `db:studio` | Prisma, proxied to server |

**Prisma (server)** — `db:generate`, `db:migrate`, `db:seed`, `db:studio` (GUI at :5555).

---

## API endpoints

Full detail in **`docs/api-contract.md`**. Summary:

- `GET /api/health`, `GET /api/health/database` — liveness + readiness (public).
- `POST /api/auth/register|login`, `GET /api/auth/me`, `POST /api/auth/promote`.
- `GET|POST /api/items`, `PATCH /api/items/:id/status` — Bearer-protected.
- `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`.

Every response uses `{ success, message, data, meta }` (or `{ success, message, errors }`).

---

## Security notes (what a reviewer will ask about)

- **3-layer RBAC** — authenticate (`auth.js`) → authorize by role (`requireRole.js`) → scope by
  ownership (the IDOR-defence example in `requireRole.js`, ready to uncomment).
- **Passwords** — bcrypt cost 10; never stored/returned in plaintext; `passwordHash` stripped
  from every response by a single `toPublicUser()`.
- **Backend password policy** — min 8 enforced server-side in `auth.validators.js`, not just in
  the UI. A curl request that skips the form is still validated.
- **Roles never self-selected** — `register` hardcodes EMPLOYEE; elevation only via ADMIN-gated
  `promote`.
- **Mass-assignment** — express-validator whitelists fields; controllers read only named fields.
- **SQL injection** — Prisma parameterises all queries; raw health check uses a tagged template.
- **User enumeration** — login returns one generic error and runs bcrypt even on missing users
  (timing-safe).
- **Rate limiting** — `express-rate-limit` on `/api/auth` only.
- **Headers / CORS** — helmet; CORS locked to `CLIENT_ORIGIN`, not `*`.
- **No secret leakage** — DB-health 503 never returns the connection string; error handler never
  returns a stack trace in production.
- **DB-enforced invariants** — `EXCLUDE USING gist` prevents booking overlaps atomically (maps to
  409); a partial unique index enforces conditional uniqueness. Rules live in the database, not
  in raceable app code.

---

## Troubleshooting (Windows)

| Symptom | Cause / fix |
| --- | --- |
| Server exits: "Missing required environment variable(s)" | No `server/.env`, or `JWT_SECRET`/`DATABASE_URL` blank. Copy the example and fill it. |
| `P3014 ... could not create the shadow database` | Role lacks `CREATEDB`. Run the `ALTER ROLE zenith CREATEDB;` command above. |
| `prisma generate` fails with `EPERM` / file locked | A `node` dev server is holding the engine. Stop `npm run dev`, then generate. |
| `curl` behaves oddly in PowerShell | PowerShell aliases `curl` to `Invoke-WebRequest`. Use `curl.exe`. |
| Client hops to port 5174 then API calls fail | Vite is set `strictPort`; free 5173. A different port would fail CORS (`CLIENT_ORIGIN`). |
| `warn ... package.json#prisma is deprecated` | Harmless in Prisma 6 (removed in 7). The seed config still works; left as-is intentionally. |
| Whole files show as changed in a diff | Line endings. `.gitattributes` sets `eol=lf`; re-clone or renormalise. |

---

## Hackathon customization

Follow **`docs/hackathon-checklist.md`** in order. The short version: pick your entity and its
one scoring rule, **rename** `Item` (schema + module + page), pick the matching DB primitive
(EXCLUDE for no-overlap, partial unique index for conditional uniqueness), freeze the API
contract, then split the work. Re-theme by editing `client/src/styles/tokens.css` only.

## Git flow

Feature branches → `dev`; only the team lead merges `dev` → `main`. Small, frequent commits from
**all four members** — judges evaluate multi-contributor activity (`git shortlog -sn`). Never
commit `.env`, `node_modules`, or `dist`.
