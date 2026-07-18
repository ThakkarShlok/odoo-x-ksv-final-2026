/**
 * WHAT: The write-side of persistent notifications. One function the rest of the app calls when
 *   something worth telling a user about happens.
 * WHY A SERVICE AND NOT INLINE prisma.notification.create: centralising it means the shape of a
 *   notification (type, message, entityRef) is defined once. When tomorrow's domain adds a
 *   "reservation confirmed" notification, it calls this with new arguments — it does not
 *   re-derive how notifications are stored.
 * WHY PERSISTENT, DISTINCT FROM react-hot-toast: a toast answers "did my click just work?" and
 *   is gone on reload. A notification answers "what happened while I was away?" and survives.
 *   Both exist in this codebase on purpose; they are not redundant.
 * REVIEWER QUESTION: "If creating a notification fails, does the triggering action fail?"
 *   -> By default no — create() is called non-blocking (fire-and-forget) after the business
 *      write, same philosophy as the audit log. Pass a `tx` to make it atomic when you truly
 *      need the notification and the action to commit together.
 */
import { prisma } from '../../config/prisma.js';

export const notificationService = {
  /**
   * @param {string}  userId    recipient
   * @param {string}  type      machine-readable category, e.g. 'ITEM_CREATED'
   * @param {string}  message   human-readable text shown in the bell dropdown
   * @param {string?} entityRef loose pointer like 'item:<uuid>' — NOT a FK (see schema comment)
   * @param {object}  tx        optional transaction client; defaults to the global pool
   */
  async create({ userId, type, message, entityRef }, tx = prisma) {
    return tx.notification.create({
      data: { userId, type, message, entityRef: entityRef ?? null },
    });
  },
};
