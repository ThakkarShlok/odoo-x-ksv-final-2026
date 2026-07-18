# API Contract

**This is the contract the team freezes on-site.** Frontend and backend both code to it. Change
it in one place, announce it, update both sides. The runtime half lives in
`server/src/lib/apiResponse.js`; keep the two in sync.

## Response envelope

Every response — success or failure — uses one of these two shapes. There are no exceptions.

**Success**
```json
{ "success": true, "message": "Human readable", "data": { }, "meta": { } }
```
- `data` — the payload (object or array). `null` when there is nothing to return.
- `meta` — optional. Carries `count`, pagination, `unreadCount`, `checkedAt`. Adding a field
  here is backward-compatible; consumers ignore keys they don't read.

**Failure**
```json
{ "success": false, "message": "Human readable", "errors": [ { "field": "email", "message": "…" } ] }
```
- `errors` — present only on 422 validation failures. Field-keyed, so the client maps each
  message under its input.
- Never contains a stack trace in production. Unknown 500s return a generic message only.

## Status codes

| Code | Meaning in Zenith |
| --- | --- |
| 200 | OK |
| 201 | Created |
| 401 | Not authenticated — missing/invalid/expired token. Client auto-logs-out. |
| 403 | Authenticated but role not permitted. |
| 404 | Not found (also returned instead of 403 for records you don't own — no existence leak). |
| 409 | Conflict — duplicate unique value, or booking overlap (EXCLUDE violation). |
| 422 | Validation failed, or illegal state transition. |
| 429 | Rate limit exceeded (on `/api/auth`). |
| 503 | Service up but a dependency (database) is unreachable. |

## Endpoints

### Health (public)
| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/health` | none | Liveness. `data.status: "healthy"`, `data.uptimeSeconds`. |
| GET | `/api/health/database` | none | Readiness. Real `SELECT 1`. 200 + `data.latencyMs`, or 503. |

### Auth
| Method | Path | Auth | Body | Notes |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | none | `{ email, password, name }` | Always creates EMPLOYEE. Returns `{ token, user }`. `role` in body is ignored. |
| POST | `/api/auth/login` | none | `{ email, password }` | Returns `{ token, user }`. Generic error on failure (no enumeration). |
| GET | `/api/auth/me` | Bearer | — | Returns `{ user }`, re-read from DB (reflects role changes). |
| POST | `/api/auth/promote` | Bearer + ADMIN | `{ userId }` | Promotes a user to ADMIN. |

`user` is always `{ id, email, name, role }`. **`passwordHash` never appears in any response.**

### Items (all Bearer-protected)
| Method | Path | Auth | Body | Notes |
| --- | --- | --- | --- | --- |
| GET | `/api/items` | Bearer | — | `data: [ { id, name, status, createdAt, updatedAt, createdBy:{id,name} } ]`, `meta.count`. |
| POST | `/api/items` | Bearer | `{ name, status? }` | Creates item (+ notification + audit). `status` defaults ACTIVE. Returns the item. |
| PATCH | `/api/items/:id/status` | Bearer | `{ status }` | State-machine guarded. Illegal move → 422. |

### Notifications (all Bearer-protected, scoped to caller)
| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/api/notifications` | Bearer | Caller's 50 latest. `meta.unreadCount`. |
| PATCH | `/api/notifications/:id/read` | Bearer | Marks one read (only if it's yours). |
| PATCH | `/api/notifications/read-all` | Bearer | Marks all the caller's read. |

## Auth header

```
Authorization: Bearer <jwt>
```
JWT payload: `{ id, email, role }`, 7-day expiry. The client stores it in `localStorage` and
attaches it via the axios request interceptor. A 401 anywhere triggers auto-logout.

## The `Item` entity is a placeholder

`Item { id, name, status(ACTIVE|INACTIVE), createdAt, updatedAt, createdById }` exists only to
prove the pipe. Tomorrow: rename it to the real entity and add fields. The envelope, auth, and
error contract above **do not change** — only the payload shape inside `data` does.
