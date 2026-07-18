/**
 * WHAT: A named wrapper around prisma.$transaction for multi-write operations that must be
 *   all-or-nothing.
 * WHY THIS OVER THE ALTERNATIVE: doing two writes as two separate awaits means a crash between
 *   them leaves the database half-updated — an item created but its audit log missing, or a
 *   balance debited but never credited. A transaction makes the pair atomic: both commit or
 *   neither does.
 * REVIEWER QUESTION: "What isolation level do your transactions run at, and why?"
 *   -> PostgreSQL's default, READ COMMITTED. Each statement sees rows committed before it began.
 *      That is the right default for our writes because correctness here is enforced by
 *      CONSTRAINTS (unique, EXCLUDE) that hold at every isolation level — not by assuming a row
 *      we read stays unchanged. When an operation's correctness DOES depend on a value it read
 *      not changing under it (e.g. "check balance, then debit"), raise it to Serializable per
 *      the commented example below and retry on the 40001 serialization error.
 *
 * We pass the transactional client `tx` into the callback. Every write inside MUST use `tx`,
 * not the global `prisma` — a call to the global `prisma` inside here runs on a SEPARATE
 * connection OUTSIDE the transaction and will not roll back. That is the one footgun of this
 * pattern, so it is stated loudly.
 */
import { prisma } from '../config/prisma.js';

export function withTransaction(callback) {
  return prisma.$transaction(callback);

  // ---- Serializable variant, for when READ COMMITTED is not enough ------------------------
  // Use this shape when the operation reads a value and then writes based on it, and a
  // concurrent transaction changing that value in between would corrupt the result:
  //
  //   return prisma.$transaction(callback, {
  //     isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  //   });
  //
  // Under Serializable, Postgres aborts one of two conflicting transactions with SQLSTATE
  // 40001 (serialization_failure). The CALLER must catch that and RETRY the whole transaction
  // — a retry loop of 3 attempts is standard. Serializable is not free (aborts + retries cost
  // throughput), which is exactly why it is opt-in per operation, not the global default.
}
