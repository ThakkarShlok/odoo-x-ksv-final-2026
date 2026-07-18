import { prisma } from '../../config/prisma.js';
import { ok, fail } from '../../lib/apiResponse.js';
import { notificationService } from './notification.service.js';

export async function listNotifications(req, res) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));

  const where = {};
  if (req.user.role !== 'ADMIN') {
    where.userId = req.user.id;
  }

  const [notifications, totalCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true, name: true, phone: true } } },
    }),
    prisma.notification.count({ where }),
  ]);

  const unreadCount = await prisma.notification.count({
    where: { userId: req.user.id, readStatus: false },
  });

  const totalPages = Math.ceil(totalCount / limit);

  return ok(res, {
    data: notifications.map((n) => ({
      id: n.id,
      recipientEmail: n.user?.email || '',
      recipientPhone: n.user?.phone || '',
      type: n.type,
      channel: 'EMAIL',
      status: n.readStatus ? 'READ' : 'SENT',
      sentAt: n.createdAt,
    })),
    meta: {
      totalCount,
      page,
      limit,
      totalPages,
      unreadCount,
    },
  });
}

export async function markRead(req, res) {
  const result = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user.id },
    data: { readStatus: true },
  });

  return ok(res, { message: 'Marked read.', data: { updated: result.count } });
}

export async function markAllRead(req, res) {
  const result = await prisma.notification.updateMany({
    where: { userId: req.user.id, readStatus: false },
    data: { readStatus: true },
  });

  return ok(res, { message: 'All marked read.', data: { updated: result.count } });
}

export async function sendManualReminder(req, res) {
  const { orderId, notificationType } = req.body;

  const order = await prisma.rentalOrder.findUnique({
    where: { id: orderId },
    include: { customer: true },
  });

  if (!order) {
    return fail(res, { status: 404, message: 'Order not found.' });
  }

  const msg =
    notificationType === 'OVERDUE_ALERT_1H'
      ? `Critical Warning: Your rental for order "${order.orderNumber}" is overdue! Late fees are accumulating.`
      : `Friendly reminder: Your rental return for order "${order.orderNumber}" is due in 24 hours.`;

  await notificationService.create({
    userId: order.customerId,
    type: notificationType,
    message: msg,
    entityRef: orderId,
  });

  return ok(res, { message: 'Notification job queued successfully in BullMQ.' });
}
