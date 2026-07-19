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
import { mailService } from './mail.service.js';

async function orderAudience(order, tx = prisma) {
  const admins = await tx.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  });

  return Array.from(new Set([order.customerId, ...admins.map((admin) => admin.id)].filter(Boolean)));
}

async function triggerEmailsForParties(order, type, recipientIds, tx = prisma) {
  try {
    const customers = await tx.user.findMany({
      where: {
        id: { in: recipientIds },
        role: 'CUSTOMER',
      },
      select: { id: true },
    });
    
    if (customers.length > 0) {
      setTimeout(() => {
        mailService.sendOrderNotificationEmail(order.id, type).catch((err) => {
          console.error(`[notification.service] Failed to send order notification email for ${order.id}:`, err);
        });
      }, 0);
    }
  } catch (err) {
    console.error('[notification.service] Failed to check and trigger emails:', err);
  }
}

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

  async createIfAbsent({ userId, type, message, entityRef }, tx = prisma) {
    const existing = await tx.notification.findFirst({
      where: {
        userId,
        type,
        entityRef: entityRef ?? null,
      },
    });

    if (existing) {
      return existing;
    }

    return this.create({ userId, type, message, entityRef }, tx);
  },

  async notifyOrderParties({ order, type, message, entityRef }, tx = prisma) {
    const recipientIds = await orderAudience(order, tx);

    // Trigger HTML emails asynchronously
    triggerEmailsForParties(order, type, recipientIds, tx);

    return Promise.all(
      recipientIds.map((userId) =>
        this.create(
          {
            userId,
            type,
            message,
            entityRef: entityRef ?? `order:${order.id}`,
          },
          tx
        )
      )
    );
  },

  async notifyOrderPartiesOnce({ order, type, message, entityRef }, tx = prisma) {
    const recipientIds = await orderAudience(order, tx);
    const targetEntityRef = entityRef ?? `order:${order.id}`;

    // Only email if the notification record does not exist yet for the customer.
    // Since sendOrderNotificationEmail only sends to the customer (order.customerId),
    // we only check if a notification already exists for the customer.
    let shouldEmail = true;
    if (order.customerId) {
      const existingNotification = await tx.notification.findFirst({
        where: {
          userId: order.customerId,
          type,
          entityRef: targetEntityRef,
        },
      });
      if (existingNotification) {
        shouldEmail = false;
      }
    }

    if (shouldEmail) {
      // Trigger HTML emails asynchronously
      triggerEmailsForParties(order, type, recipientIds, tx);
    }

    return Promise.all(
      recipientIds.map((userId) =>
        this.createIfAbsent(
          {
            userId,
            type,
            message,
            entityRef: targetEntityRef,
          },
          tx
        )
      )
    );
  },
};
