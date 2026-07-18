/**
 * WHAT: Item handlers. createItem is the integration centrepiece — it exercises FIVE of the
 *   reusable skeletons in one request, which is exactly what makes it the reference to copy:
 *     1. auth        — req.user comes from the verified token (route-level middleware)
 *     2. transaction — the item + its notification commit atomically via withTransaction
 *     3. notification— a persistent row is written inside that transaction
 *     4. audit log   — an append-only ActivityLog row is written (non-blocking, after commit)
 *     5. envelope    — every response is ok()/fail()
 *   updateStatus additionally exercises the state-machine guard.
 * REVIEWER QUESTION: "Show me one endpoint that ties your patterns together." -> createItem.
 */
import { prisma } from '../../config/prisma.js';
import { ok, fail } from '../../lib/apiResponse.js';
import { withTransaction } from '../../lib/withTransaction.js';
import { logActivity } from '../../lib/activityLog.js';
import { notificationService } from '../notifications/notification.service.js';
import { assertTransition } from './transitions.js';

// The public projection for an Item. Explicit select, never a raw row spread — see the note in
// the list query about why `include` on anything reaching User is dangerous.
const ITEM_SELECT = {
  id: true,
  name: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true } },
};

/** GET /api/items */
export async function listItems(req, res) {
  const items = await prisma.item.findMany({
    orderBy: { createdAt: 'desc' },
    select: ITEM_SELECT,
  });
  return ok(res, { message: 'Items retrieved', data: items, meta: { count: items.length } });
}

/**
 * POST /api/items
 * The item and its "created" notification are ONE atomic unit: if the notification write fails,
 * the item is rolled back too, so we never show an item that silently produced no notification.
 * The audit log is deliberately OUTSIDE the transaction (non-blocking) — auditing must not be
 * able to fail a legitimate create. That split is the whole point of the two side-effects
 * being demonstrated differently. See the notes in withTransaction.js and activityLog.js.
 */
export async function createItem(req, res) {
  const { name, status } = req.body; // whitelist: only these two are read
  const actorId = req.user.id;

  const item = await withTransaction(async (tx) => {
    const created = await tx.item.create({
      data: {
        name,
        status: status ?? 'ACTIVE',
        // Ownership stamped from the TOKEN, never from the body. This is what layer-3
        // ownership scoping later filters on.
        createdById: actorId,
      },
      select: ITEM_SELECT,
    });

    // Atomic with the item: pass `tx`. If this throws, the item insert rolls back.
    await notificationService.create(
      {
        userId: actorId,
        type: 'ITEM_CREATED',
        message: `Item "${created.name}" was created.`,
        entityRef: `item:${created.id}`,
      },
      tx
    );

    return created;
  });

  // Non-blocking audit AFTER the commit. Uses the global client, swallows its own errors.
  logActivity({
    userId: actorId,
    action: 'item.create',
    entityType: 'Item',
    entityId: item.id,
    metadata: { name: item.name, status: item.status },
  });

  return ok(res, { status: 201, message: 'Item created', data: item });
}

/**
 * PATCH /api/items/:id/status
 * Demonstrates the state-machine guard: the requested move is validated against transitions.js
 * BEFORE any write. An illegal move is a 422 and the row is untouched.
 */
export async function updateStatus(req, res) {
  const { status: nextStatus } = req.body;

  const existing = await prisma.item.findUnique({
    where: { id: req.params.id },
    select: { id: true, status: true, name: true },
  });
  if (!existing) return fail(res, { status: 404, message: 'Item not found.' });

  // Throws 422 if illegal. Enum-to-enum move legality, checked before touching the DB.
  assertTransition(existing.status, nextStatus);

  const updated = await prisma.item.update({
    where: { id: existing.id },
    data: { status: nextStatus },
    select: ITEM_SELECT,
  });

  logActivity({
    userId: req.user.id,
    action: 'item.status_change',
    entityType: 'Item',
    entityId: updated.id,
    metadata: { from: existing.status, to: nextStatus },
  });

  return ok(res, { message: 'Status updated', data: updated });
}
