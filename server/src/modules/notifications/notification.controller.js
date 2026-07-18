/**
 * WHAT: Read-side of notifications for the bell UI — list mine, mark one read, mark all read.
 * OWNERSHIP (IDOR defence, layer 3 in practice): every query is scoped to req.user.id. A user
 *   can only ever see or mutate THEIR OWN notifications. markRead filters by BOTH id AND userId,
 *   so passing someone else's notification id changes nothing (updateMany returns count 0)
 *   rather than letting you mark a stranger's notification read.
 */
import { prisma } from '../../config/prisma.js';
import { ok } from '../../lib/apiResponse.js';

/** GET /api/notifications — the caller's notifications, newest first, plus an unread count. */
export async function listNotifications(req, res) {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50, // the bell shows recent items, not all of history
    }),
    prisma.notification.count({ where: { userId: req.user.id, readStatus: false } }),
  ]);

  return ok(res, {
    message: 'Notifications retrieved.',
    data: notifications,
    meta: { unreadCount },
  });
}

/** PATCH /api/notifications/:id/read — mark ONE of mine read. */
export async function markRead(req, res) {
  // updateMany with a userId filter, not update({ where: { id } }): the extra userId condition
  // is the ownership scope. update() would touch the row by id alone — an IDOR hole.
  const result = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user.id },
    data: { readStatus: true },
  });

  return ok(res, { message: 'Marked read.', data: { updated: result.count } });
}

/** PATCH /api/notifications/read-all — mark all of mine read. */
export async function markAllRead(req, res) {
  const result = await prisma.notification.updateMany({
    where: { userId: req.user.id, readStatus: false },
    data: { readStatus: true },
  });

  return ok(res, { message: 'All marked read.', data: { updated: result.count } });
}
