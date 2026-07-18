-- ============================================================================
-- MIGRATION 004 — RENTAL CONSTRAINTS  (hand-written; do NOT regenerate)
-- ============================================================================
-- Everything in this file is something PRISMA CANNOT EXPRESS in schema.prisma:
--   (1) the btree_gist extension,
--   (2) the EXCLUDE no-overlap constraint on reservations (partial, by status),
--   (3) partial UNIQUE indexes (one default pricelist / address, one active settings row),
--   (4) CHECK constraints (non-negative money, valid ranges, cap ceilings, delivery needs address),
--   (5) a partial index for the "pending events" dashboard cards,
--   (6) an APPEND-ONLY deposit-balance trigger (an aggregate invariant a row CHECK cannot do).
-- Column identifiers are quoted camelCase because the Prisma models are not @map-ed to snake_case
-- (matching the repo's existing convention, e.g. migration 002's "resourceId").
--
-- ----------------------------------------------------------------------------
-- DRIFT BEHAVIOUR (same mechanism verified for migration 002): objects Prisma cannot model are
-- invisible to its drift detection. After this migration, `prisma migrate dev`/`migrate diff`
-- reports the schema in sync and never tries to drop these. Drift only appears if someone adds
-- such objects to the DB by hand WITHOUT a migration.
-- RECOVERY if drift is ever reported:
--   non-destructive:  npx prisma migrate resolve --applied 20260718000100_rental_constraints
--   last resort (WIPES DATA, re-runs all migrations + seed):  npx prisma migrate reset   -- ask first
-- ----------------------------------------------------------------------------

-- (1) EXTENSION --------------------------------------------------------------
-- btree_gist lets a single GiST index mix equality (=) on a scalar (the unit id) with range
-- overlap (&&) on the tsrange — exactly what the EXCLUDE below needs. Idempotent.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- (2) NO-OVERLAP EXCLUDE on reservations -------------------------------------
-- THE anti-double-booking rule, enforced by Postgres, not application code. Reads as:
--   "no two reservations may share the same productUnitId AND have overlapping `during` ranges,
--    among reservations that are currently live."
-- The WHERE clause makes it a PARTIAL exclusion: only HELD/ACTIVE/FULFILLED holds block. A
-- RELEASED or CANCELLED reservation for a future window must NOT block a re-booking, and this is
-- how we let it not. (Migration 002's booking_slot demo had no such status filter; a real domain
-- needs one, which is the upgrade here.)
--
-- WHY UNIT-LEVEL (productUnitId) AND NOT PRODUCT-LEVEL: a rental "product" (e.g. a drill) has
-- several physical units. Two customers CAN rent the drill for the same dates — as long as they
-- get DIFFERENT units. Overlap is only a conflict on the SAME physical unit, so the constraint
-- keys on the unit. A product-level constraint would wrongly forbid legitimate concurrent rentals
-- of different copies. If we instead modelled availability as a QUANTITY POOL (N interchangeable
-- copies, no serial identity), there would be no per-row range to exclude; we'd enforce
-- "concurrent overlapping reservations <= stock" with a counting check (a trigger or a serializable
-- transaction summing overlaps), which is weaker and race-prone. We chose serialized units because
-- this domain tracks serial/asset tags and condition per unit anyway. See docs/schema-decisions.md.
--
-- The EXCLUDE implicitly CREATES a GiST index on ("productUnitId", during) — that index is what
-- makes both the overlap check and availability search fast; we do not declare it separately.
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_no_overlap"
  EXCLUDE USING gist ("productUnitId" WITH =, "during" WITH &&)
  WHERE (status IN ('HELD', 'ACTIVE', 'FULFILLED'));

-- (3) PARTIAL UNIQUE INDEXES -------------------------------------------------
-- "At most one default pricelist." A plain UNIQUE(isDefault) would forbid more than one row per
-- boolean value (so only one false, too). The partial index applies uniqueness ONLY to rows where
-- isDefault = true, i.e. many non-defaults, exactly one default. Prisma cannot express a filtered
-- unique index, so it is here.
CREATE UNIQUE INDEX "pricelists_one_default"
  ON "pricelists" (("isDefault"))
  WHERE "isDefault" = true;

-- "At most one default address per user." Same pattern, scoped per user.
CREATE UNIQUE INDEX "addresses_one_default_per_user"
  ON "addresses" ("userId")
  WHERE "isDefault" = true;

-- "At most one active RentalSettings row." The app reads the single active config; this guarantees
-- there is never an ambiguous pair of active rows to choose between.
CREATE UNIQUE INDEX "rental_settings_one_active"
  ON "rental_settings" (("isActive"))
  WHERE "isActive" = true;

-- (4) CHECK CONSTRAINTS ------------------------------------------------------
-- Truths the database can enforce so no code path can violate them. Non-negative money, sane
-- ranges, and the two "snapshot makes it a row-level check" wins (late fee <= its own snapshotted
-- cap; delivery orders must carry an address).

-- Money is never negative. (Refund DIRECTION is carried by DepositEntryType/PaymentPurpose, so the
-- stored amount is always a positive magnitude — see the enum comments in schema.prisma.)
ALTER TABLE "rental_orders"      ADD CONSTRAINT "rental_orders_money_nonneg"
  CHECK ("subtotal" >= 0 AND "taxTotal" >= 0 AND "total" >= 0 AND "depositTotal" >= 0);
ALTER TABLE "rental_order_lines" ADD CONSTRAINT "rental_order_lines_amounts_valid"
  CHECK ("rateApplied" >= 0 AND "lineSubtotal" >= 0 AND "durationCount" > 0);
ALTER TABLE "pricelist_items"    ADD CONSTRAINT "pricelist_items_rate_nonneg"    CHECK ("rate" >= 0);
ALTER TABLE "payments"           ADD CONSTRAINT "payments_amount_positive"       CHECK ("amount" > 0);
ALTER TABLE "deposit_ledger"     ADD CONSTRAINT "deposit_ledger_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "invoices"           ADD CONSTRAINT "invoices_amount_nonneg"         CHECK ("amount" >= 0);
ALTER TABLE "rental_settings"    ADD CONSTRAINT "rental_settings_values_nonneg"
  CHECK ("depositValue" >= 0 AND "gracePeriodHours" >= 0 AND "lateFeeValue" >= 0 AND "maxLateFeeCap" >= 0);

-- Rental window must be a real forward interval.
ALTER TABLE "rental_orders" ADD CONSTRAINT "rental_orders_period_valid"
  CHECK ("rentalEnd" > "rentalStart");

-- Delivery requires a delivery address; store-pickup must NOT carry one (keeps the two fulfilment
-- shapes from silently mixing). Enforced at the row, no trigger needed.
ALTER TABLE "rental_orders" ADD CONSTRAINT "rental_orders_delivery_needs_address"
  CHECK (
    ("fulfillmentMethod" = 'DELIVERY'     AND "deliveryAddressId" IS NOT NULL) OR
    ("fulfillmentMethod" = 'STORE_PICKUP' AND "deliveryAddressId" IS NULL)
  );

-- Late fee: non-negative, days non-negative, and — because the cap is SNAPSHOTTED onto this same
-- row — "fee <= configured cap" collapses to a plain row-level CHECK. This is the concrete payoff
-- of snapshotting the rule: an aggregate/cross-table rule becomes a local invariant.
ALTER TABLE "late_fees" ADD CONSTRAINT "late_fees_valid"
  CHECK ("amount" >= 0 AND "daysLate" >= 0 AND "graceHours" >= 0 AND "ruleValue" >= 0
         AND "capAmount" >= 0 AND "amount" <= "capAmount");

-- (5) PARTIAL INDEX for the "upcoming" dashboard cards -----------------------
-- Upcoming Pickups / Upcoming Returns only ever look at events NOT yet completed (actualAt IS
-- NULL). A partial index over just those rows is smaller and hotter than the full
-- (eventType, scheduledAt) index for this specific access path. Query shape it serves:
--   SELECT ... FROM rental_events
--   WHERE eventType = $1 AND actualAt IS NULL AND scheduledAt BETWEEN now() AND $window
--   ORDER BY scheduledAt;
CREATE INDEX "rental_events_pending"
  ON "rental_events" ("eventType", "scheduledAt")
  WHERE "actualAt" IS NULL;

-- (6) DEPOSIT-BALANCE TRIGGER (append-only ledger, aggregate invariant) ------
-- The rule "total deductions + refunds may never exceed total held" is an AGGREGATE over all
-- ledger rows of an order — a single-row CHECK cannot see the other rows, so a CHECK is the wrong
-- tool. We enforce it with a BEFORE INSERT trigger that:
--   (a) takes a row lock on the parent order (SELECT ... FOR UPDATE) so two concurrent
--       withdrawals cannot both read a stale balance and both pass — this is the concurrency
--       correctness point;
--   (b) sums the existing entries and rejects any DEDUCTED/REFUNDED that would drive the balance
--       negative, raising SQLSTATE 23514 (check_violation).
-- The ledger stays APPEND-ONLY: nothing here updates or deletes; a mutable deposit_balance column
-- would be the alternative and we rejected it (see docs/schema-decisions.md) because it can drift
-- from the entries and needs its own locking to stay correct — the ledger IS the source of truth.
CREATE OR REPLACE FUNCTION "enforce_deposit_balance"() RETURNS trigger AS $$
DECLARE
  held      numeric(12,2) := 0;
  withdrawn numeric(12,2) := 0;
BEGIN
  -- Serialize deposit mutations per order. Any concurrent ledger insert for the same order waits
  -- here until we commit, so the balance we compute below cannot be raced.
  PERFORM 1 FROM "rental_orders" WHERE "id" = NEW."orderId" FOR UPDATE;

  IF NEW."entryType" = 'HELD' THEN
    RETURN NEW;  -- holds only increase the balance; always allowed
  END IF;

  SELECT
    COALESCE(SUM("amount") FILTER (WHERE "entryType" = 'HELD'), 0),
    COALESCE(SUM("amount") FILTER (WHERE "entryType" IN ('DEDUCTED','REFUNDED')), 0)
  INTO held, withdrawn
  FROM "deposit_ledger"
  WHERE "orderId" = NEW."orderId";

  IF withdrawn + NEW."amount" > held THEN
    RAISE EXCEPTION
      'deposit withdrawal (%) would exceed held balance (%) for order %',
      (withdrawn + NEW."amount"), held, NEW."orderId"
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "deposit_balance_guard"
  BEFORE INSERT ON "deposit_ledger"
  FOR EACH ROW EXECUTE FUNCTION "enforce_deposit_balance"();
