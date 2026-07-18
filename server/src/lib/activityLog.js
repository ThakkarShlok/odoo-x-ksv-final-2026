/**
 * WHAT: Append-only audit logger. Records "who did what to which entity" into activity_logs.
 * WHY THIS OVER THE ALTERNATIVE: sprinkling console.log for audit means the trail vanishes on
 *   restart and cannot be queried. A table with JSONB metadata is queryable, survives restarts,
 *   and is where "show me everything that touched item X" comes from.
 * REVIEWER QUESTION: "If writing the audit log fails, does the user's action fail too?"
 *   -> No. This is deliberately NON-BLOCKING and NEVER THROWS. Auditing is a side effect; a
 *      transient logging failure must not roll back a legitimate business write. It logs its own
 *      failure to stderr and returns. (Contrast: in a regulated domain where the audit IS the
 *      product, you would instead write it INSIDE the transaction so it is all-or-nothing —
 *      see the note below. We keep it outside because here the item write is the source of
 *      truth, not the log.)
 *
 * APPEND-ONLY is enforced by convention AND absence: there is no update or delete path to this
 * table anywhere in the codebase. Nothing edits history. That is what makes it an audit trail
 * rather than just another mutable table.
 */
import { prisma } from '../config/prisma.js';

/**
 * @param {object}  entry
 * @param {string?} entry.userId      actor; null/undefined for system-generated events
 * @param {string}  entry.action      verb, e.g. 'item.create'
 * @param {string}  entry.entityType  e.g. 'Item'
 * @param {string?} entry.entityId    affected row id
 * @param {object?} entry.metadata    arbitrary JSON context (before/after, request info)
 * @param {object?} tx                optional transaction client — see note below
 */
export async function logActivity({ userId, action, entityType, entityId, metadata }, tx = prisma) {
  try {
    await tx.activityLog.create({
      data: {
        userId: userId ?? null,
        action,
        entityType,
        entityId: entityId ?? null,
        metadata: metadata ?? undefined,
      },
    });
  } catch (err) {
    // Swallow. A failed audit write must never surface to the user or abort their action.
    // It is logged to the server console so the failure is still observable in ops.
    console.error('[activityLog] failed (non-fatal):', err?.message);
  }

  // WHEN TO PASS `tx`: if you want the audit row to be part of a transaction — commit together
  // with the business write, roll back together — call logActivity(entry, tx) from inside
  // withTransaction. But then a logging failure DOES abort the business write, which is the
  // opposite of the non-blocking guarantee above. Choose per operation: non-blocking by
  // default (global prisma), atomic only when the audit is legally load-bearing.
}
