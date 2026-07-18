-- ============================================================================
-- MIGRATION 002 — CONCURRENCY PRIMITIVES  (hand-written; do NOT regenerate)
-- ============================================================================
-- WHY THIS MIGRATION IS HAND-WRITTEN:
--   Prisma generated the CREATE TABLE + resourceId index for booking_slot (it knows the model
--   from schema.prisma). Everything ELSE in this file — the btree_gist extension, the EXCLUDE
--   constraint, and the partial unique index — CANNOT be expressed in the Prisma schema at all.
--   So we generated the table with `migrate dev --create-only` and appended the raw DDL by hand.
--   Keeping these primitives in their own migration (not mixed into 001_init) makes it obvious
--   to a reviewer exactly where we stopped trusting the ORM and reached for SQL.
--
-- ----------------------------------------------------------------------------
-- DRIFT BEHAVIOUR (verified empirically on 2026-07-17, Prisma 6.19.3 / PG 18):
--   After applying this migration, running `prisma migrate dev` again with NO schema changes
--   reports:  "Already in sync, no schema change or pending migration was found."
--   Prisma does NOT flag the EXCLUDE constraint or the partial unique index as drift, and does
--   NOT try to drop them. Reason: Prisma's drift detection replays the migration history onto a
--   shadow DB and compares that to the live DB. These objects exist identically in both (they
--   came FROM a migration), so there is nothing to diff. Objects Prisma cannot model are simply
--   invisible to it — it neither recreates nor removes them.
--
--   THE ONE WAY DRIFT *WOULD* APPEAR: if someone adds these objects to the DB by hand (psql)
--   WITHOUT a migration, the live DB would then contain objects the shadow DB does not, and
--   `migrate dev` would report drift and offer to reset. The discipline that prevents this:
--   every schema change goes through a migration file, never a manual psql ALTER.
--
--   RECOVERY IF DRIFT IS EVER REPORTED (e.g. someone hand-edited the DB):
--     Preferred (non-destructive) — reconcile by re-baselining the applied migration:
--       npx prisma migrate resolve --applied 20260717165343_concurrency_primitives
--     Last resort (DESTRUCTIVE — wipes all data, re-runs every migration + seed):
--       npx prisma migrate reset
--     ^ Never run reset during the demo without a fresh `npm run db:seed` after. Ask first.
-- ----------------------------------------------------------------------------

-- (1) EXTENSION -------------------------------------------------------------------------------
-- btree_gist teaches GiST indexes to handle equality on scalar types (uuid, int, text). A GiST
-- index natively understands "overlaps" (&&) for ranges but NOT "=" for a uuid; the EXCLUDE
-- constraint below needs BOTH in the same index, so the extension is a hard prerequisite.
-- IF NOT EXISTS makes this idempotent and safe to replay.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- (2) TABLE (Prisma-generated above this line was moved here unchanged) -----------------------
CREATE TABLE "booking_slot" (
    "id" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "during" tsrange NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_slot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "booking_slot_resourceId_idx" ON "booking_slot"("resourceId");

-- (3) EXCLUDE CONSTRAINT — the no-overlap rule ------------------------------------------------
-- THE CORE PRIMITIVE. Reads as: "no two rows may have the SAME resourceId (=) AND OVERLAPPING
-- during ranges (&&) at the same time." Postgres enforces this atomically at INSERT/UPDATE time
-- using the GiST index — there is no read-then-write race to lose. Two concurrent bookings for
-- the same resource and overlapping times: one commits, the other raises SQLSTATE 23P01, which
-- src/lib/prismaErrors.js maps to a clean 409. This is the correct way to prevent double-booking
-- and it lives in the DATABASE, not in application code that could be bypassed or raced.
--
-- TOMORROW: rename booking_slot -> your entity, resourceId -> your resource FK, keep `during`.
-- The rule is copy-rename, exactly as intended. Column is "resourceId" (Prisma's camelCase),
-- NOT resource_id — match your real column name here.
ALTER TABLE "booking_slot"
    ADD CONSTRAINT "booking_slot_no_overlap"
    EXCLUDE USING gist ("resourceId" WITH =, "during" WITH &&);

-- (4) PARTIAL UNIQUE INDEX — a conditional uniqueness example --------------------------------
-- A plain UNIQUE(name) would forbid duplicate names forever. A PARTIAL unique index applies the
-- uniqueness ONLY to rows matching the WHERE clause — here, "at most one ACTIVE item may hold a
-- given name," while any number of INACTIVE (e.g. archived/soft-deleted) rows may reuse it.
-- This is the standard pattern for "one active record per key" (one active email per account,
-- one default address per user, one live booking per slot) and Prisma cannot express it, which
-- is why it is here in raw SQL.
CREATE UNIQUE INDEX "items_unique_active_name"
    ON "items" ("name")
    WHERE "status" = 'ACTIVE';
