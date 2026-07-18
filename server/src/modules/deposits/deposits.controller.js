import { prisma } from '../../config/prisma.js';
import { ok, fail } from '../../lib/apiResponse.js';
import { logActivity } from '../../lib/activityLog.js';

export async function getDepositDetails(req, res) {
  const { orderId } = req.params;

  const order = await prisma.rentalOrder.findUnique({
    where: { id: orderId },
    include: { depositLedger: true },
  });

  if (!order) {
    return fail(res, { status: 404, message: 'Order not found.' });
  }

  const heldEntries = order.depositLedger.filter((e) => e.entryType === 'HELD');
  const deductedEntries = order.depositLedger.filter((e) => e.entryType === 'DEDUCTED');
  const refundedEntries = order.depositLedger.filter((e) => e.entryType === 'REFUNDED');

  const amountHeld = heldEntries.reduce((acc, e) => acc + parseFloat(e.amount), 0);
  const amountDeducted = deductedEntries.reduce((acc, e) => acc + parseFloat(e.amount), 0);
  const amountRefunded = refundedEntries.reduce((acc, e) => acc + parseFloat(e.amount), 0);

  const balance = amountHeld - amountDeducted - amountRefunded;

  const firstHeld = heldEntries[0];

  return ok(res, {
    data: {
      id: firstHeld?.id || 'deposit-none',
      orderId,
      method: 'FIXED', // default representation
      amountHeld: amountHeld.toString(),
      status: balance <= 0 ? 'SETTLED' : 'HELD',
      transactionId: firstHeld?.id ? `auth_hold_${firstHeld.id.slice(0, 8)}` : null,
      refundedAmount: amountRefunded.toString(),
      reconciledDate: refundedEntries[0]?.createdAt || null,
    },
  });
}

export async function reconcileDeposit(req, res) {
  const { id } = req.params; // deposit id, or maps to orderId

  let ledgerRecord = null;
  try {
    ledgerRecord = await prisma.depositLedger.findUnique({
      where: { id },
    });
  } catch (error) {
    // Keep ledgerRecord as null
  }

  const orderId = ledgerRecord ? ledgerRecord.orderId : id;

  const order = await prisma.rentalOrder.findUnique({
    where: { id: orderId },
    include: { depositLedger: true, events: true },
  });

  if (!order) {
    return fail(res, { status: 404, message: 'Deposit or Order not found.' });
  }

  // Financial Safety Gate Check: Return inspection checksheet must be completed
  // i.e., there must be a RETURN event with actualAt != null
  const returnEvent = order.events.find((e) => e.eventType === 'RETURN');
  if (!returnEvent || !returnEvent.actualAt) {
    return fail(res, {
      status: 400,
      message: 'Return inspections are pending (Financial Safety Gate violation).',
    });
  }

  const heldEntries = order.depositLedger.filter((e) => e.entryType === 'HELD');
  const deductedEntries = order.depositLedger.filter((e) => e.entryType === 'DEDUCTED');
  const refundedEntries = order.depositLedger.filter((e) => e.entryType === 'REFUNDED');

  const amountHeld = heldEntries.reduce((acc, e) => acc + parseFloat(e.amount), 0);
  const amountDeducted = deductedEntries.reduce((acc, e) => acc + parseFloat(e.amount), 0);
  const amountRefunded = refundedEntries.reduce((acc, e) => acc + parseFloat(e.amount), 0);

  const balance = amountHeld - amountDeducted - amountRefunded;

  if (balance <= 0) {
    return fail(res, { status: 400, message: 'Deposit is already settled.' });
  }

  await prisma.$transaction(async (tx) => {
    // Record deposit refund ledger entry
    await tx.depositLedger.create({
      data: {
        orderId: order.id,
        entryType: 'REFUNDED',
        amount: balance,
        reason: 'On inspection sign-off, remaining deposit balance refunded',
      },
    });

    // Close the order
    await tx.rentalOrder.update({
      where: { id: order.id },
      data: { status: 'CLOSED' },
    });
  });

  logActivity({
    userId: req.user.id,
    action: 'deposit.reconcile',
    entityType: 'RentalOrder',
    entityId: order.id,
    metadata: { refund: balance.toString() },
  });

  const finalStatus = amountDeducted > 0 ? 'PARTIALLY_REFUNDED' : 'REFUNDED';

  return ok(res, {
    data: {
      depositId: id,
      amountHeld: amountHeld.toString(),
      lateFeesDeducted: amountDeducted.toString(),
      refundedAmount: balance.toString(),
      status: finalStatus,
      reconciledDate: new Date(),
    },
  });
}

export async function overrideDeposit(req, res) {
  const { id } = req.params;
  const { overrideAmount, rationale } = req.body;

  let ledgerRecord = null;
  try {
    ledgerRecord = await prisma.depositLedger.findUnique({
      where: { id },
    });
  } catch (error) {
    // Keep ledgerRecord as null
  }

  const orderId = ledgerRecord ? ledgerRecord.orderId : id;

  const order = await prisma.rentalOrder.findUnique({
    where: { id: orderId },
    include: { depositLedger: true },
  });

  if (!order) {
    return fail(res, { status: 404, message: 'Deposit or Order not found.' });
  }

  const heldEntries = order.depositLedger.filter((e) => e.entryType === 'HELD');
  const deductedEntries = order.depositLedger.filter((e) => e.entryType === 'DEDUCTED');
  const refundedEntries = order.depositLedger.filter((e) => e.entryType === 'REFUNDED');

  const amountHeld = heldEntries.reduce((acc, e) => acc + parseFloat(e.amount), 0);
  const amountDeducted = deductedEntries.reduce((acc, e) => acc + parseFloat(e.amount), 0);
  const amountRefunded = refundedEntries.reduce((acc, e) => acc + parseFloat(e.amount), 0);

  const currentBalance = amountHeld - amountDeducted - amountRefunded;
  const targetRefund = parseFloat(overrideAmount);

  if (targetRefund > currentBalance) {
    return fail(res, { status: 400, message: 'Override exceeds remaining held deposit amount.' });
  }

  const result = await prisma.$transaction(async (tx) => {
    // Record override refund
    await tx.depositLedger.create({
      data: {
        orderId: order.id,
        entryType: 'REFUNDED',
        amount: targetRefund,
        reason: `Admin override: ${rationale}`,
      },
    });

    // Close the order
    await tx.rentalOrder.update({
      where: { id: order.id },
      data: { status: 'CLOSED' },
    });

    // Log to immutable Audit/Activity trail
    const audit = await tx.activityLog.create({
      data: {
        userId: req.user.id,
        action: 'deposit.admin_override',
        entityType: 'DepositLedger',
        entityId: id,
        metadata: {
          orderId: order.id,
          overrideAmount: targetRefund.toString(),
          rationale,
        },
      },
    });

    return audit;
  });

  return ok(res, {
    data: {
      depositId: id,
      refundedAmount: targetRefund.toString(),
      status: 'REFUNDED',
      auditLogId: result.id,
    },
  });
}
