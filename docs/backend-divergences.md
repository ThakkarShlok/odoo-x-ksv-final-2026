# Backend divergence inventory (flag-only — do not refactor beyond the demo path)

Every place the running backend diverges from `schema.prisma` / the intended design, found during
the Step-0 reconciliation. This is a **briefing for the backend owner**, not a task list — I only
fixed what the demo path required (marked ✅ RESOLVED). Everything else is left as-is by request.

## Fixed on the demo path (authorized)
- ✅ **RESOLVED — `RentalOrder.actualReturnTime` / `totalPenalties` were missing.** `returnScan`
  wrote both; they weren't columns, so return-scan threw. Added as nullable `DateTime?` /
  `Decimal(12,2)?` in **migration 005** (`20260718000200_add_return_tracking`). No existing column
  or constraint changed. Structural drift after: **none** (`migrate diff` → "No difference detected").
- ✅ **ADDED — customer catalogue + availability.** New public `GET /api/catalog` (real
  PricelistItem rates) and `GET /api/catalog/availability` (genuine date-range overlap check via
  the `reservations_no_overlap` GiST index). Fills the missing customer browse/availability path.

## Flagged, NOT fixed

1. **Migration-history integrity: `20260718000000_rental_domain` was modified after it was applied.**
   `prisma migrate dev` now demands a destructive reset on this DB (checksum mismatch between the
   committed file and what this DB recorded at apply time — a teammate's "Backend" commit/merge
   regenerated or edited the applied migration). **Structural drift is zero** (verified); only the
   history record disagrees. Workaround in use: `migrate deploy` + `migrate diff` instead of
   `migrate dev`. Proper fix (owner): re-baseline with `prisma migrate resolve`, or align every
   dev DB onto one migration set. **Never** edit an already-applied migration file.

2. **`FIELD_AGENT` role gates real endpoints but no such role exists.** `requireRole('ADMIN','FIELD_AGENT')`
   guards handover, return-scan, inventory, deposits/reconcile, inspections, ai. `Role` enum is
   `{ADMIN, CUSTOMER}` only — so these are effectively **ADMIN-only** (CUSTOMER 403, verified). Not
   a crash. Fix: add `FIELD_AGENT` to the enum (migration) *or* drop it from the `requireRole` calls.

3. **`GET /api/products` returns Categories with hardcoded rates.** `baseHourlyRate:"10.00"`,
   `baseDailyRate:"50.00"` are literals; deposit fields come from an in-memory map or settings
   default — **disconnected from the real `PricelistItem` rates.** Use `/api/catalog` for real rates.

4. **In-memory stores that reset on every server restart** (data that looks persistent but isn't):
   - `products.controller`: `categorySettings`, `quotationTemplates`
   - `inventory.controller`: `telemetryLogs`
   - `auth.controller`: `refreshTokens` (⚠ all refresh sessions die on restart → tokens can't be
     refreshed after a bounce; access-token-only until then)

5. **Deposit over-deduction vs the balance trigger.** `returnScan` inserts `DEDUCTED = full late fee`.
   If the late fee **exceeds the held deposit**, migration-004's balance trigger correctly rejects
   it (`23514`) and return-scan 500s. The demo path only works when **late fee ≤ deposit** (true for
   the seeded/curated orders). `chargePenalty` has related logic that can double-deduct. Fix: cap the
   ledger `DEDUCTED` at `min(lateFee, heldBalance)` and capture any remainder as a `LATE_FEE` payment.

6. **Deposit `HELD` is recorded at handover, not at payment authorize.** `authorize` creates
   Payment+Invoice but no ledger entry; the `HELD` entry appears at pickup. Between CONFIRMED and
   pickup the deposit isn't in the ledger. Semantic note, not a break.

7. **Auth response contract differs from the old client's assumptions** (client fixed in this pass):
   login → `{ accessToken, user{fullName,phoneNumber,address} }` (not `token`/`name`); **register
   returns no token** (no auto-login); access token 15 min; refresh via httpOnly `SameSite=Strict`
   cookie + `POST /auth/refresh`.

8. **`createQuotation` always prices DAILY.** It computes `durationDays = ceil(ms/day)` and reads
   only the `DAILY` pricelist rate, ignoring HOURLY/WEEKLY/MONTHLY even though the pricelist has them.

9. **Phantom/aspirational domains with no schema backing** — off the demo path, deferred: telemetry
   / IoT, AI maintenance tickets + forecasting, Cloudinary upload signatures, quotation templates.

## One verification artifact left in the DB
Driving the return-scan proof created one extra **CLOSED** order (`RO-2026-…`, Concrete Mixer,
settled late return). It is valid data and harmless (it enriches the dashboard with a real settled
late return). Remove it only via a reseed if you want the curated A–G set exactly.
