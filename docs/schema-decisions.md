# Schema Decisions — reviewer cheat-sheet

Say these out loud. Each is a decision with a defended alternative.

## 1. Unit-level vs pool-level reservation

We reserve a **specific `ProductUnit`**, not a `Product` type, and the no-overlap rule
(`EXCLUDE USING gist (productUnitId WITH =, during WITH &&)`) keys on the unit. A rental product
(say a drill) has several physical copies; two customers renting the drill for the same dates is
perfectly legal *as long as they get different units*. A conflict only exists on the **same
physical unit**, so that is what the constraint keys on. A product-level constraint would wrongly
reject legitimate concurrent rentals of different copies. The alternative is a **quantity-pool**
model — track "N interchangeable units in stock" with no serial identity, and enforce
"overlapping reservations ≤ stock". That is a *counting* invariant: there is no per-row range to
exclude, so you cannot use a range EXCLUDE. You would enforce it with a trigger or a `SERIALIZABLE`
transaction that sums overlapping reservations and compares to stock — which is weaker (application
logic, race-prone under concurrency) than a database exclusion constraint that is atomic by
construction. We chose serialized units because this domain already tracks serial/asset tags,
per-unit condition, and per-unit status (maintenance, damaged) — the unit is a real entity here, so
keying availability on it is both correct and free. The GiST index the constraint creates also
drives the availability search, so we pay for one index and get both.

## 2. Deposit ledger vs a mutable balance column

Deposits are an **append-only `DepositLedger`** of `HELD` / `DEDUCTED` / `REFUNDED` entries, each a
positive magnitude with the direction carried by the type. The current balance is **derived**:
`Σ HELD − Σ DEDUCTED − Σ REFUNDED`. There is no `deposit_balance` column anywhere. The alternative
— a mutable balance column updated on each movement — has two failure modes an ERP cannot accept:
it can silently **drift** from the underlying entries (a bug, a partial failure, a manual fix, and
the column now lies), and it loses the **audit trail** of how the balance got where it is, which is
exactly what a financial dispute needs. The ledger *is* the source of truth; the balance is a query.
The one real cost of a ledger — a running-total invariant like "you cannot refund more than is
held" spans multiple rows and a single-row `CHECK` cannot see them — we pay with a `BEFORE INSERT`
trigger that locks the parent order (`SELECT … FOR UPDATE`, so two concurrent withdrawals cannot
both read a stale balance) and rejects any withdrawal that would drive the balance negative
(`SQLSTATE 23514`). Verified live: an over-deduction on a settled deposit is rejected.

## 3. Snapshotting rates and rules

When an order line is priced we store the **`rateApplied`** on the line; when a late fee is computed
we store the **rule parameters used** (`ruleType`, `ruleValue`, `graceHours`, `capAmount`) on the
`LateFee` row. These are deliberate **copies** of live config, not foreign keys to it. The reason is
**temporal correctness**: an admin editing a pricelist or the late-fee policy tomorrow must not
retroactively change what a customer was charged last week. If the line pointed at a live
`PricelistItem` and we recomputed money from it, every historical invoice would silently rewrite
itself the moment a rate changed — the cardinal sin in an ERP. Yes, this is denormalization (the
rate exists both on the pricelist and, once used, on the line), but it is denormalization for a
correct reason: the line's copy is a **historical fact**, and facts don't update. A concrete payoff:
because the cap is snapshotted onto the `LateFee` row, the rule "fee ≤ cap" becomes a plain
row-level `CHECK (amount <= capAmount)` — a cross-table policy check collapses into a local
invariant precisely because we copied the value.

## 4. Enum vs lookup table

Every state and type is a **PostgreSQL enum** (`RentalOrderStatus`, `PaymentStatus`,
`ProductUnitStatus`, `DepositEntryType`, `FulfillmentMethod`, `DurationUnit`, `ProductCondition`,
`ReservationStatus`, `InvoiceStatus`, and the rule-type enums), not a `status_id` FK into a lookup
table. For a **closed, small, code-driven** set of values — ones our application logic branches on —
an enum is the right tool: it is enforced by the database (an illegal value is rejected at write,
not by a forgotten `if`), it is self-documenting in the schema, and it needs no join to read. A
lookup table earns its place when the set is **user-editable at runtime**, carries **extra columns**
(labels, colors, sort order, per-tenant variants), or must be **queried/reported on as data** — none
of which applies to a rental order's lifecycle, which changes only when we ship code. The one honest
cost of an enum is that *adding* a value is a migration (`ALTER TYPE … ADD VALUE`) rather than an
`INSERT`; we accept that because these value sets change rarely and deliberately, and the migration
is a feature (it's reviewed), not a chore. We proved the migration cost is real and manageable when
we narrowed `Role` from three values to `{ADMIN, CUSTOMER}` in migration 003.

## 5. Index rationale

We index **deliberately, to match real query shapes**, not reflexively.

- **All foreign keys are indexed** — Postgres does *not* auto-index FK columns, and an unindexed FK
  makes both joins and the parent's cascade/restrict checks do sequential scans.
- **Composite dashboard indexes follow the leftmost-prefix rule.** The dashboard cards (Active
  Rentals, Due Today, Overdue) are all `status = … AND rentalEnd <compare> …`, so
  `(status, rentalEnd)` serves every one of them: the equality column (`status`) is the leftmost
  prefix, and `rentalEnd` serves both the range predicate and any `ORDER BY rentalEnd`. Upcoming
  Pickups is `status = 'CONFIRMED' AND rentalStart BETWEEN …`, served by `(status, rentalStart)`.
  Customer order history is `customerId = … ORDER BY createdAt DESC`, served by
  `(customerId, createdAt DESC)` with the sort direction baked into the index so there is no sort
  step.
- **Partial index for the "upcoming" cards.** `rental_events_pending` is `(eventType, scheduledAt)
  WHERE actualAt IS NULL` — pickups/returns not yet done. It is smaller and hotter than a full index
  because it stores only the rows those cards ever look at.
- **The GiST index from the EXCLUDE** on `(productUnitId, during)` drives both the overlap check and
  availability search; we don't declare a second one. We *do* keep a plain btree on
  `reservations.productUnitId` because GiST is weaker at plain equality joins than btree — different
  jobs, both earning their keep.
- **What we deliberately did NOT index:** standalone low-cardinality flags (`isRentable`,
  `damageFlag`, `fulfillmentMethod`) — a 2-value index is not selective enough to beat a sequential
  scan, so those columns only appear as the *trailing* part of a composite where the leading column
  already narrows the set. We also don't index `updatedAt` (never a query filter) or the audit
  log's JSONB metadata (write-hot, no point-lookup read pattern). Indexes are not free — every one is
  a write-time cost — so each must pay for itself with a read pattern that exists.
