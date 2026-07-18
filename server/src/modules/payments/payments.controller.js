import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { ok, fail, AppError } from '../../lib/apiResponse.js';
import { logActivity } from '../../lib/activityLog.js';
import { withTransaction } from '../../lib/withTransaction.js';

function moneyToPaise(amount) {
  return Math.round(Number(amount) * 100);
}

function signatureFor({ orderId, paymentId }) {
  return crypto
    .createHmac('sha256', env.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

function hasRazorpayConfig() {
  return Boolean(env.razorpayKeyId && env.razorpayKeySecret);
}

async function findPayableOrder({ orderId, actor }) {
  const order = await prisma.rentalOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      payments: { orderBy: { createdAt: 'asc' } },
      lines: { select: { productUnitId: true } },
    },
  });

  if (!order) {
    return null;
  }

  if (actor.role !== 'ADMIN' && order.customerId !== actor.id) {
    return null;
  }

  return order;
}

async function finalizeVerifiedPayment({ order, razorpayPaymentId }) {
  return withTransaction(async (tx) => {
    const alreadyCaptured = await tx.payment.findMany({
      where: {
        orderId: order.id,
        reference: razorpayPaymentId,
        status: 'CAPTURED',
      },
    });
    if (alreadyCaptured.length > 0) {
      throw new AppError('This Razorpay payment has already been processed for the order.', 409);
    }

    const now = new Date();
    const totalAmount = Number(order.total) + Number(order.depositTotal);

    const rentalPayment = await tx.payment.create({
      data: {
        orderId: order.id,
        amount: Number(order.total),
        purpose: 'RENTAL',
        status: 'CAPTURED',
        method: 'razorpay',
        reference: razorpayPaymentId,
        processedAt: now,
      },
    });

    let depositPayment = null;
    if (Number(order.depositTotal) > 0) {
      depositPayment = await tx.payment.create({
        data: {
          orderId: order.id,
          amount: Number(order.depositTotal),
          purpose: 'DEPOSIT',
          status: 'CAPTURED',
          method: 'razorpay',
          reference: razorpayPaymentId,
          processedAt: now,
        },
      });
    }

    await tx.rentalOrder.update({
      where: { id: order.id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: now,
      },
    });

    await tx.reservation.updateMany({
      where: { orderId: order.id, status: 'HELD' },
      data: { status: 'ACTIVE' },
    });

    if (Number(order.depositTotal) > 0) {
      await tx.depositLedger.create({
        data: {
          orderId: order.id,
          entryType: 'HELD',
          amount: Number(order.depositTotal),
          reason: 'Security deposit held on verified payment confirmation',
        },
      });
    }

    await tx.invoice.create({
      data: {
        orderId: order.id,
        invoiceNumber: `INV-2026-${order.orderNumber.split('-').slice(-1)}`,
        status: 'ISSUED',
        amount: totalAmount,
        issuedAt: now,
      },
    });

    return { rentalPayment, depositPayment, totalAmount, confirmedAt: now };
  });
}

export async function createPaymentOrder(req, res) {
  if (!hasRazorpayConfig()) {
    return fail(res, {
      status: 503,
      message: 'Razorpay is not configured on this server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env.',
    });
  }

  const { orderId } = req.body;
  const order = await findPayableOrder({ orderId, actor: req.user });

  if (!order) {
    return fail(res, { status: 404, message: 'Order not found.' });
  }

  if (order.status !== 'QUOTATION') {
    return fail(res, { status: 409, message: 'Only quotations can be sent to checkout.' });
  }

  const amount = Number(order.total) + Number(order.depositTotal);
  const body = {
    amount: moneyToPaise(amount),
    currency: order.currency || 'INR',
    receipt: order.orderNumber,
    notes: {
      orderId: order.id,
      customerId: order.customerId,
    },
  };

  const auth = Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[payments.create-order] razorpay error', response.status, text);
    return fail(res, {
      status: 502,
      message: 'Razorpay order creation failed. Please try again.',
    });
  }

  const gatewayOrder = await response.json();

  return ok(res, {
    message: 'Razorpay order created.',
    data: {
      keyId: env.razorpayKeyId,
      razorpayOrderId: gatewayOrder.id,
      amount: amount.toFixed(2),
      amountPaise: gatewayOrder.amount,
      currency: gatewayOrder.currency,
      orderNumber: order.orderNumber,
      customer: order.customer ? { name: order.customer.name, email: order.customer.email } : null,
    },
  });
}

export async function verifyPayment(req, res) {
  if (!hasRazorpayConfig()) {
    return fail(res, {
      status: 503,
      message: 'Razorpay is not configured on this server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env.',
    });
  }

  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  const order = await findPayableOrder({ orderId, actor: req.user });

  if (!order) {
    return fail(res, { status: 404, message: 'Order not found.' });
  }

  if (order.status !== 'QUOTATION') {
    return fail(res, { status: 409, message: 'This quotation has already been confirmed or is no longer payable.' });
  }

  const expected = signatureFor({ orderId: razorpayOrderId, paymentId: razorpayPaymentId });
  const provided = razorpaySignature.trim();
  const valid =
    expected.length === provided.length &&
    crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided, 'utf8'));

  if (!valid) {
    return fail(res, { status: 400, message: 'Razorpay signature verification failed.' });
  }

  // Production note: a webhook should call this SAME finalization path after verifying the webhook
  // signature. The trust boundary is the HMAC signature check, not the browser saying "payment
  // succeeded" — browser callbacks are convenient UX, but still untrusted input until verified.
  const result = await finalizeVerifiedPayment({ order, razorpayPaymentId });

  logActivity({
    userId: req.user.id,
    action: 'payment.verify',
    entityType: 'RentalOrder',
    entityId: order.id,
    metadata: {
      orderId: order.id,
      razorpayOrderId,
      razorpayPaymentId,
      totalAmount: result.totalAmount.toFixed(2),
    },
  });

  return ok(res, {
    message: 'Payment verified and order confirmed.',
    data: {
      orderId: order.id,
      orderStatus: 'CONFIRMED',
      rentalPaymentId: result.rentalPayment.id,
      depositPaymentId: result.depositPayment?.id ?? null,
      transactionId: razorpayPaymentId,
      amount: result.totalAmount.toFixed(2),
      gatewayStatus: 'captured',
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
