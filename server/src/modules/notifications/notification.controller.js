import { prisma } from '../../config/prisma.js';
import { ok, fail } from '../../lib/apiResponse.js';
import { notificationService } from './notification.service.js';

export async function listNotifications(req, res) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));
  const readStatus = req.query.readStatus || 'ALL';
  const scope = req.query.scope || 'MINE';
  const type = req.query.type;

  const where = {};
  if (req.user.role !== 'ADMIN' || scope !== 'ALL') {
    where.userId = req.user.id;
  }
  if (readStatus === 'READ') {
    where.readStatus = true;
  } else if (readStatus === 'UNREAD') {
    where.readStatus = false;
  }
  if (type) {
    where.type = type;
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
      userId: n.userId,
      recipientEmail: n.user?.email || '',
      recipientPhone: n.user?.phone || '',
      type: n.type,
      message: n.message,
      entityRef: n.entityRef,
      channel: 'EMAIL',
      status: n.readStatus ? 'READ' : 'SENT',
      readStatus: n.readStatus,
      createdAt: n.createdAt,
      sentAt: n.createdAt,
    })),
    meta: {
      totalCount,
      page,
      limit,
      totalPages,
      unreadCount,
      readStatus,
      scope: req.user.role === 'ADMIN' ? scope : 'MINE',
      type: type ?? null,
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

  const normalizedType =
    notificationType === 'PRE_RETURN_24H'
      ? 'RETURN_DUE_TOMORROW'
      : notificationType === 'OVERDUE_ALERT_1H'
        ? 'RETURN_OVERDUE'
        : notificationType;

  const message =
    normalizedType === 'RETURN_OVERDUE'
      ? `Order ${order.orderNumber} is overdue. Return needs attention immediately.`
      : normalizedType === 'PICKUP_DUE_TOMORROW'
        ? `Order ${order.orderNumber} is scheduled for pickup tomorrow.`
        : `Order ${order.orderNumber} is due back tomorrow.`;

  await notificationService.notifyOrderPartiesOnce({
    order,
    type: normalizedType,
    message,
    entityRef: `order:${order.id}`,
  });

  return ok(res, { message: 'Reminder notification recorded.' });
}
