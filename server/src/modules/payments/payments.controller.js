import crypto from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { ok, fail } from '../../lib/apiResponse.js';
import { logActivity } from '../../lib/activityLog.js';

export async function authorizePayment(req, res) {
  const { orderId, paymentMethodToken } = req.body;

  const order = await prisma.rentalOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return fail(res, { status: 404, message: 'Order not found.' });
  }

  if (order.status !== 'QUOTATION') {
    return fail(res, { status: 400, message: 'Order is not in QUOTATION state.' });
  }

  const amount = parseFloat(order.total) + parseFloat(order.depositTotal);

  const payment = await prisma.$transaction(async (tx) => {
    // Create Payment transaction log
    const pay = await tx.payment.create({
      data: {
        orderId,
        amount,
        purpose: 'RENTAL',
        status: 'AUTHORIZED',
        method: 'card',
        reference: `ch_${crypto.randomUUID().slice(0, 12)}`,
        processedAt: new Date(),
      },
    });

    // Update order status to CONFIRMED (ready for pickup)
    await tx.rentalOrder.update({
      where: { id: orderId },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    // Generate draft Invoice
    await tx.invoice.create({
      data: {
        orderId,
        invoiceNumber: `INV-2026-${order.orderNumber.split('-').slice(-1)}`,
        status: 'ISSUED',
        amount: order.total,
        issuedAt: new Date(),
      },
    });

    return pay;
  });

  logActivity({
    userId: req.user.id,
    action: 'payment.authorize',
    entityType: 'Payment',
    entityId: payment.id,
    metadata: { orderId, amount: amount.toString() },
  });

  return ok(res, {
    data: {
      paymentId: payment.id,
      transactionId: payment.reference,
      amount: amount.toString(),
      gatewayStatus: 'succeeded',
      orderStatus: 'AUTHORIZED',
    },
  });
}

export async function chargePenalty(req, res) {
  const { orderId } = req.params;
  const { paymentMethodToken } = req.body;

  const order = await prisma.rentalOrder.findUnique({
    where: { id: orderId },
    include: { lateFees: true },
  });

  if (!order) {
    return fail(res, { status: 404, message: 'Order not found.' });
  }

  // Calculate outstanding late fees
  const totalLateFees = order.lateFees.reduce((acc, f) => acc + parseFloat(f.amount), 0);
  const depositHeld = parseFloat(order.depositTotal);

  const outstandingLiability = totalLateFees - depositHeld;
  if (outstandingLiability <= 0) {
    return fail(res, { status: 400, message: 'No outstanding penalty balance exists on this order.' });
  }

  const payment = await prisma.$transaction(async (tx) => {
    // Deduct remaining deposit balance to 0 (meaning all deposit used for penalties)
    await tx.depositLedger.create({
      data: {
        orderId,
        entryType: 'DEDUCTED',
        amount: depositHeld,
        reason: 'Entire deposit deducted to cover late return penalties',
      },
    });

    // Capture penalty payment for the remaining balance
    const pay = await tx.payment.create({
      data: {
        orderId,
        amount: outstandingLiability,
        purpose: 'LATE_FEE',
        status: 'CAPTURED',
        method: 'card',
        reference: `ch_${crypto.randomUUID().slice(0, 12)}`,
        processedAt: new Date(),
      },
    });

    // Create Invoice for outstanding late fee liability
    await tx.invoice.create({
      data: {
        orderId,
        invoiceNumber: `INV-LATE-${order.orderNumber.split('-').slice(-1)}`,
        status: 'PAID',
        amount: outstandingLiability,
        issuedAt: new Date(),
      },
    });

    // Close order
    await tx.rentalOrder.update({
      where: { id: orderId },
      data: { status: 'CLOSED' },
    });

    return pay;
  });

  logActivity({
    userId: req.user.id,
    action: 'payment.charge_penalty',
    entityType: 'Payment',
    entityId: payment.id,
    metadata: { orderId, amount: outstandingLiability.toString() },
  });

  return ok(res, {
    data: {
      paymentId: payment.id,
      transactionId: payment.reference,
      amount: outstandingLiability.toString(),
      gatewayStatus: 'succeeded',
    },
  });
}

export async function listPayments(req, res) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));

  const [payments, totalCount] = await Promise.all([
    prisma.payment.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payment.count(),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return ok(res, {
    data: payments.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      amount: p.amount.toString(),
      transactionId: p.reference,
      gatewayStatus: p.status,
      paymentType: p.purpose === 'LATE_FEE' ? 'PENALTY_SETTLEMENT' : 'RENTAL_AND_DEPOSIT',
      createdAt: p.createdAt,
    })),
    meta: {
      totalCount,
      page,
      limit,
      totalPages,
    },
  });
}
