import crypto from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { ok, fail } from '../../lib/apiResponse.js';
import { logActivity } from '../../lib/activityLog.js';

function pad(n) {
  return String(n).padStart(2, '0');
}

function ts(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

function toPublicRental(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    customer: order.customer ? { name: order.customer.name, email: order.customer.email } : undefined,
    status: order.status,
    fulfillmentMethod: order.fulfillmentMethod,
    rentalStart: order.rentalStart,
    rentalEnd: order.rentalEnd,
    actualReturnTime: order.actualReturnTime,
    totalBaseCost: order.total.toString(),
    totalDeposit: order.depositTotal.toString(),
    totalPenalties: order.totalPenalties?.toString() || '0.00',
    createdAt: order.createdAt,
    confirmedAt: order.confirmedAt,
  };
}

export async function listRentals(req, res) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));
  const status = req.query.status;
  const customerId = req.query.customerId;

  const where = {};
  if (status) {
    where.status = status;
  }

  // IDOR defence: Customers can only query their own rentals
  if (req.user.role === 'CUSTOMER') {
    where.customerId = req.user.id;
  } else if (customerId) {
    where.customerId = customerId;
  }

  const [orders, totalCount] = await Promise.all([
    prisma.rentalOrder.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { customer: { select: { name: true, email: true } } },
    }),
    prisma.rentalOrder.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return ok(res, {
    data: orders.map(toPublicRental),
    meta: {
      totalCount,
      page,
      limit,
      totalPages,
    },
  });
}

export async function createQuotation(req, res) {
  const { rentalStart, rentalEnd, fulfillmentMethod, items, customerId } = req.body;

  const start = new Date(rentalStart);
  const end = new Date(rentalEnd);

  if (end <= start) {
    return fail(res, { status: 400, message: 'rentalEnd must be after rentalStart.' });
  }

  const targetCustomerId = req.user.role === 'CUSTOMER' ? req.user.id : customerId;
  if (!targetCustomerId) {
    return fail(res, { status: 400, message: 'customerId is required for storefront quotations.' });
  }

  // Fetch settings and pricelist
  const settings = await prisma.rentalSettings.findFirst({ where: { isActive: true } });
  const pricelist = await prisma.pricelist.findFirst({ where: { isDefault: true } });

  const durationMs = end.getTime() - start.getTime();
  const durationDays = Math.ceil(durationMs / (24 * 60 * 60 * 1000));

  const orderNumber = `RO-2026-${Date.now().toString().slice(-6)}`;

  try {
    const order = await prisma.$transaction(async (tx) => {
    let subtotal = 0;
    let depositTotal = 0;

    const lineItems = [];

    for (const item of items) {
      let unit;
      
      if (item.assetId) {
        unit = await tx.productUnit.findUnique({
          where: { id: item.assetId },
          include: { product: true },
        });
      } else if (item.productId) {
        // Rent a specific item model
        unit = await tx.productUnit.findFirst({
          where: {
            status: 'AVAILABLE',
            productId: item.productId,
          },
          include: { product: true },
        });
      } else if (item.categoryId) {
        // Auto-assign logic for storefront customers
        unit = await tx.productUnit.findFirst({
          where: {
            status: 'AVAILABLE',
            product: { categoryId: item.categoryId },
          },
          include: { product: true },
        });
      }

      if (!unit) {
        throw new Error(`Available unit not found for this product category.`);
      }

      if (unit.status !== 'AVAILABLE') {
        throw new Error(`Asset ${unit.serialNumber} is not available.`);
      }

      // Check rates from pricelist
      let pricelistItem = null;
      if (pricelist) {
        pricelistItem = await tx.pricelistItem.findFirst({
          where: {
            pricelistId: pricelist.id,
            productId: unit.productId,
            durationUnit: 'DAILY',
          },
        });
      }

      const dailyRate = pricelistItem ? parseFloat(pricelistItem.rate) : 50.00;
      const itemSubtotal = dailyRate * durationDays;
      subtotal += itemSubtotal;

      let itemDeposit = 0;
      if (settings) {
        if (settings.depositRuleType === 'PERCENTAGE') {
          itemDeposit = itemSubtotal * (parseFloat(settings.depositValue) / 100);
        } else {
          itemDeposit = parseFloat(settings.depositValue);
        }
      } else {
        itemDeposit = itemSubtotal * 0.20; // fallback to 20%
      }
      depositTotal += itemDeposit;

      lineItems.push({
        productId: unit.productId,
        productUnitId: unit.id,
        durationUnit: 'DAILY',
        durationCount: durationDays,
        rateApplied: dailyRate,
        lineSubtotal: itemSubtotal,
      });
    }

    const total = subtotal;

    const newOrder = await tx.rentalOrder.create({
      data: {
        orderNumber,
        customerId: targetCustomerId,
        status: 'QUOTATION',
        fulfillmentMethod,
        rentalStart: start,
        rentalEnd: end,
        subtotal,
        taxTotal: 0,
        total,
        depositTotal,
        pricelistId: pricelist.id,
      },
    });

    for (const line of lineItems) {
      await tx.rentalOrderLine.create({
        data: {
          orderId: newOrder.id,
          ...line,
        },
      });

      // Create Reservation hold (raw SQL because of tsrange)
      const resId = crypto.randomUUID();
      await tx.$executeRawUnsafe(
        `INSERT INTO reservations (id, "orderId", "productUnitId", during, status, "createdAt", "updatedAt")
         VALUES ($1::uuid, $2::uuid, $3::uuid, tsrange($4::timestamp, $5::timestamp), 'HELD', now(), now())`,
        resId, newOrder.id, line.productUnitId, ts(start), ts(end)
      );

      // Lock asset status
      await tx.productUnit.update({
        where: { id: line.productUnitId },
        data: { status: 'RESERVED' },
      });
    }

    return newOrder;
  }).catch((err) => {
    throw err;
  });

  logActivity({
    userId: req.user.id,
    action: 'rental.create_quotation',
    entityType: 'RentalOrder',
    entityId: order.id,
    metadata: { orderNumber: order.orderNumber },
  });

  return ok(res, {
    status: 201,
    data: toPublicRental(order),
  });
  } catch (error) {
    return fail(res, { status: 400, message: error.message || 'Failed to create quotation.' });
  }
}

export async function handoverPickup(req, res) {
  const { id } = req.params;
  const { barcodes } = req.body;

  const order = await prisma.rentalOrder.findUnique({
    where: { id },
    include: { lines: { include: { productUnit: true } } },
  });

  if (!order) {
    return fail(res, { status: 404, message: 'Order not found.' });
  }

  // In schema.prisma, pickup starts from CONFIRMED. In api.md it checks status is AUTHORIZED
  // Let's accept CONFIRMED or QUOTATION (if bypass payments)
  if (order.status !== 'CONFIRMED' && order.status !== 'QUOTATION') {
    return fail(res, { status: 400, message: 'Order status is not valid for pickup.' });
  }

  const orderBarcodes = order.lines.map((l) => l.productUnit.serialNumber);
  const match = barcodes.every((b) => orderBarcodes.includes(b));
  if (!match) {
    return fail(res, { status: 400, message: 'Scanned barcodes do not match order assets.' });
  }

  await prisma.$transaction(async (tx) => {
    // Set order to active pickup state
    await tx.rentalOrder.update({
      where: { id },
      data: { status: 'IN_RENTAL' },
    });

    for (const line of order.lines) {
      // Update unit status to RENTED
      await tx.productUnit.update({
        where: { id: line.productUnitId },
        data: { status: 'RENTED' },
      });

      // Update reservation status to ACTIVE
      await tx.reservation.updateMany({
        where: { orderId: id, productUnitId: line.productUnitId },
        data: { status: 'ACTIVE' },
      });
    }

    // Record pickup event
    await tx.rentalEvent.create({
      data: {
        orderId: id,
        eventType: 'PICKUP',
        scheduledAt: order.rentalStart,
        actualAt: new Date(),
        inspectedById: req.user.id,
      },
    });

    // Record Deposit Ledger hold capture
    await tx.depositLedger.create({
      data: {
        orderId: id,
        entryType: 'HELD',
        amount: order.depositTotal,
        reason: 'Security deposit held on pickup',
      },
    });
  });

  logActivity({
    userId: req.user.id,
    action: 'rental.handover',
    entityType: 'RentalOrder',
    entityId: id,
  });

  return ok(res, { message: 'Handover completed. Order status updated to ACTIVE.' });
}

export async function returnScan(req, res) {
  const { id } = req.params;
  const { barcodes } = req.body;

  const order = await prisma.rentalOrder.findUnique({
    where: { id },
    include: { lines: { include: { productUnit: true } } },
  });

  if (!order) {
    return fail(res, { status: 404, message: 'Order not found.' });
  }

  if (order.status !== 'IN_RENTAL') {
    return fail(res, { status: 400, message: 'Order is not in active rental status.' });
  }

  const orderBarcodes = order.lines.map((l) => l.productUnit.serialNumber);
  const match = barcodes.every((b) => orderBarcodes.includes(b));
  if (!match) {
    return fail(res, { status: 400, message: 'Scanned barcodes do not match order assets.' });
  }

  const actualReturnTime = new Date();

  // Check if late return fees should be calculated
  const rentalEnd = new Date(order.rentalEnd);
  const diffHours = (actualReturnTime.getTime() - rentalEnd.getTime()) / (1000 * 60 * 60);

  const settings = await prisma.rentalSettings.findFirst({ where: { isActive: true } });
  const gracePeriod = settings?.gracePeriodHours || 0;

  let lateFeesCalculated = 0;
  if (diffHours > gracePeriod) {
    const daysLate = Math.ceil((actualReturnTime.getTime() - rentalEnd.getTime()) / (24 * 60 * 60 * 1000));
    const lateFeePerDay = settings ? parseFloat(settings.lateFeeValue) : 500;
    const maxCap = settings ? parseFloat(settings.maxLateFeeCap) : 5000;
    lateFeesCalculated = Math.min(daysLate * lateFeePerDay, maxCap);
  }

  await prisma.$transaction(async (tx) => {
    // In schema.prisma, return updates status to RETURNED
    await tx.rentalOrder.update({
      where: { id },
      data: {
        status: 'RETURNED',
        actualReturnTime,
        totalPenalties: lateFeesCalculated,
      },
    });

    for (const line of order.lines) {
      // Update unit status to AVAILABLE (inspection checkheets final verification will approve deposit refund)
      await tx.productUnit.update({
        where: { id: line.productUnitId },
        data: { status: 'AVAILABLE' },
      });

      // Update reservation status to FULFILLED
      await tx.reservation.updateMany({
        where: { orderId: id, productUnitId: line.productUnitId },
        data: { status: 'FULFILLED' },
      });
    }

    // Record return event (marks returns for inspection checks)
    await tx.rentalEvent.create({
      data: {
        orderId: id,
        eventType: 'RETURN',
        scheduledAt: order.rentalEnd,
        actualAt: actualReturnTime,
        inspectedById: req.user.id,
      },
    });

    if (lateFeesCalculated > 0) {
      // Record late fee details
      const lateFee = await tx.lateFee.create({
        data: {
          orderId: id,
          amount: lateFeesCalculated,
          daysLate: Math.ceil((actualReturnTime.getTime() - rentalEnd.getTime()) / (24 * 60 * 60 * 1000)),
          ruleType: settings?.lateFeeRuleType || 'PER_DAY_FLAT',
          ruleValue: settings?.lateFeeValue || 500,
          graceHours: gracePeriod,
          capAmount: settings?.maxLateFeeCap || 5000,
        },
      });

      // Record Deposit Ledger deduction for late fee
      await tx.depositLedger.create({
        data: {
          orderId: id,
          entryType: 'DEDUCTED',
          amount: lateFeesCalculated,
          reason: 'Late return fee deduction',
          relatedLateFeeId: lateFee.id,
        },
      });
    }
  });

  logActivity({
    userId: req.user.id,
    action: 'rental.return',
    entityType: 'RentalOrder',
    entityId: id,
    metadata: { lateFees: lateFeesCalculated.toString() },
  });

  return ok(res, {
    data: {
      orderId: id,
      status: 'RETURNED',
      actualReturnTime,
      lateFeesCalculated: lateFeesCalculated.toString(),
    },
  });
}

export async function cancelRental(req, res) {
  const { id } = req.params;

  const order = await prisma.rentalOrder.findUnique({
    where: { id },
    include: { lines: true },
  });

  if (!order) {
    return fail(res, { status: 404, message: 'Order not found.' });
  }

  // IDOR check: Customer can only cancel their own order
  if (req.user.role === 'CUSTOMER' && order.customerId !== req.user.id) {
    return fail(res, { status: 403, message: 'Forbidden. Scoped to owner.' });
  }

  if (order.status !== 'QUOTATION' && order.status !== 'CONFIRMED') {
    return fail(res, { status: 400, message: 'Order cannot be cancelled in active state.' });
  }

  await prisma.$transaction(async (tx) => {
    await tx.rentalOrder.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    for (const line of order.lines) {
      await tx.productUnit.update({
        where: { id: line.productUnitId },
        data: { status: 'AVAILABLE' },
      });

      await tx.reservation.updateMany({
        where: { orderId: id, productUnitId: line.productUnitId },
        data: { status: 'CANCELLED' },
      });
    }
  });

  logActivity({
    userId: req.user.id,
    action: 'rental.cancel',
    entityType: 'RentalOrder',
    entityId: id,
  });

  return ok(res, { message: `Order cancelled. Hold amount of $${order.depositTotal} has been released.` });
}

// ─── Single order detail ─────────────────────────────────────────
export async function getRentalById(req, res) {
  const { id } = req.params;

  const order = await prisma.rentalOrder.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      lines: {
        include: {
          product: { select: { id: true, name: true, sku: true, brand: true } },
          productUnit: { select: { id: true, serialNumber: true, condition: true, status: true } },
        },
      },
      payments: { orderBy: { createdAt: 'desc' } },
      depositLedger: { orderBy: { createdAt: 'asc' } },
      lateFees: true,
      invoices: { orderBy: { createdAt: 'desc' } },
      events: { orderBy: { createdAt: 'asc' }, include: { inspectedBy: { select: { name: true } } } },
    },
  });

  if (!order) {
    return fail(res, { status: 404, message: 'Order not found.' });
  }

  // IDOR defence: customers can only see their own orders
  if (req.user.role === 'CUSTOMER' && order.customerId !== req.user.id) {
    return fail(res, { status: 403, message: 'Forbidden.' });
  }

  // Compute deposit balance from ledger
  let depositHeld = 0, depositDeducted = 0, depositRefunded = 0;
  for (const entry of order.depositLedger) {
    const amt = parseFloat(entry.amount);
    if (entry.entryType === 'HELD') depositHeld += amt;
    else if (entry.entryType === 'DEDUCTED') depositDeducted += amt;
    else if (entry.entryType === 'REFUNDED') depositRefunded += amt;
  }
  const depositBalance = depositHeld - depositDeducted - depositRefunded;

  return ok(res, {
    data: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      fulfillmentMethod: order.fulfillmentMethod,
      rentalStart: order.rentalStart,
      rentalEnd: order.rentalEnd,
      subtotal: order.subtotal.toString(),
      taxTotal: order.taxTotal.toString(),
      total: order.total.toString(),
      depositTotal: order.depositTotal.toString(),
      currency: order.currency,
      confirmedAt: order.confirmedAt,
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
      customer: order.customer,
      lines: order.lines.map((l) => ({
        id: l.id,
        product: l.product,
        unit: l.productUnit,
        durationUnit: l.durationUnit,
        durationCount: l.durationCount,
        rateApplied: l.rateApplied.toString(),
        lineSubtotal: l.lineSubtotal.toString(),
      })),
      payments: order.payments.map((p) => ({
        id: p.id,
        amount: p.amount.toString(),
        purpose: p.purpose,
        status: p.status,
        method: p.method,
        reference: p.reference,
        createdAt: p.createdAt,
      })),
      depositLedger: order.depositLedger.map((d) => ({
        id: d.id,
        entryType: d.entryType,
        amount: d.amount.toString(),
        reason: d.reason,
        createdAt: d.createdAt,
      })),
      depositSummary: {
        held: depositHeld.toFixed(2),
        deducted: depositDeducted.toFixed(2),
        refunded: depositRefunded.toFixed(2),
        balance: depositBalance.toFixed(2),
      },
      lateFees: order.lateFees.map((f) => ({
        id: f.id,
        amount: f.amount.toString(),
        daysLate: f.daysLate,
        ruleType: f.ruleType,
        ruleValue: f.ruleValue.toString(),
        graceHours: f.graceHours,
        capAmount: f.capAmount.toString(),
        computedAt: f.computedAt,
      })),
      invoices: order.invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        amount: inv.amount.toString(),
        issuedAt: inv.issuedAt,
      })),
      events: order.events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        scheduledAt: e.scheduledAt,
        actualAt: e.actualAt,
        conditionNotes: e.conditionNotes,
        damageFlag: e.damageFlag,
        inspectorName: e.inspectedBy?.name,
      })),
    },
  });
}

// ─── Unified lifecycle action dispatcher ─────────────────────────
export async function performOrderAction(req, res) {
  const { id } = req.params;
  const { action } = req.body;

  const order = await prisma.rentalOrder.findUnique({
    where: { id },
    include: { lines: { include: { productUnit: true } }, depositLedger: true, events: true },
  });

  if (!order) {
    return fail(res, { status: 404, message: 'Order not found.' });
  }

  switch (action) {
    case 'CONFIRM': {
      if (order.status !== 'QUOTATION') {
        return fail(res, { status: 400, message: 'Only QUOTATION orders can be confirmed.' });
      }
      await prisma.rentalOrder.update({
        where: { id },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      });
      return ok(res, { message: 'Order confirmed.', data: { status: 'CONFIRMED' } });
    }

    case 'HANDOVER': {
      if (order.status !== 'CONFIRMED' && order.status !== 'QUOTATION') {
        return fail(res, { status: 400, message: 'Order must be CONFIRMED for handover.' });
      }
      await prisma.$transaction(async (tx) => {
        await tx.rentalOrder.update({ where: { id }, data: { status: 'IN_RENTAL' } });
        for (const line of order.lines) {
          await tx.productUnit.update({ where: { id: line.productUnitId }, data: { status: 'RENTED' } });
          await tx.reservation.updateMany({
            where: { orderId: id, productUnitId: line.productUnitId },
            data: { status: 'ACTIVE' },
          });
        }
        await tx.rentalEvent.create({
          data: {
            orderId: id, eventType: 'PICKUP',
            scheduledAt: order.rentalStart, actualAt: new Date(),
            inspectedById: req.user.id,
          },
        });
        await tx.depositLedger.create({
          data: {
            orderId: id, entryType: 'HELD',
            amount: order.depositTotal,
            reason: 'Security deposit held on pickup',
          },
        });
      });
      logActivity({ userId: req.user.id, action: 'rental.handover', entityType: 'RentalOrder', entityId: id });
      return ok(res, { message: 'Handover completed.', data: { status: 'IN_RENTAL' } });
    }

    case 'RETURN': {
      if (order.status !== 'IN_RENTAL') {
        return fail(res, { status: 400, message: 'Order must be IN_RENTAL for return.' });
      }
      const actualReturnTime = new Date();
      const rentalEnd = new Date(order.rentalEnd);
      const diffHours = (actualReturnTime.getTime() - rentalEnd.getTime()) / (1000 * 60 * 60);
      const settings = await prisma.rentalSettings.findFirst({ where: { isActive: true } });
      const gracePeriod = settings?.gracePeriodHours || 0;
      let lateFeesCalculated = 0;

      if (diffHours > gracePeriod) {
        const daysLate = Math.ceil((actualReturnTime.getTime() - rentalEnd.getTime()) / (24 * 60 * 60 * 1000));
        const lateFeePerDay = settings ? parseFloat(settings.lateFeeValue) : 500;
        const maxCap = settings ? parseFloat(settings.maxLateFeeCap) : 5000;
        lateFeesCalculated = Math.min(daysLate * lateFeePerDay, maxCap);
      }

      await prisma.$transaction(async (tx) => {
        await tx.rentalOrder.update({ where: { id }, data: { status: 'RETURNED' } });
        for (const line of order.lines) {
          await tx.productUnit.update({ where: { id: line.productUnitId }, data: { status: 'AVAILABLE' } });
          await tx.reservation.updateMany({
            where: { orderId: id, productUnitId: line.productUnitId },
            data: { status: 'FULFILLED' },
          });
        }
        await tx.rentalEvent.create({
          data: {
            orderId: id, eventType: 'RETURN',
            scheduledAt: order.rentalEnd, actualAt: actualReturnTime,
            inspectedById: req.user.id,
          },
        });
        if (lateFeesCalculated > 0) {
          const lateFee = await tx.lateFee.create({
            data: {
              orderId: id,
              amount: lateFeesCalculated,
              daysLate: Math.ceil((actualReturnTime.getTime() - rentalEnd.getTime()) / (24 * 60 * 60 * 1000)),
              ruleType: settings?.lateFeeRuleType || 'PER_DAY_FLAT',
              ruleValue: settings?.lateFeeValue || 500,
              graceHours: gracePeriod,
              capAmount: settings?.maxLateFeeCap || 5000,
            },
          });
          await tx.depositLedger.create({
            data: {
              orderId: id, entryType: 'DEDUCTED',
              amount: lateFeesCalculated,
              reason: 'Late return fee deduction',
              relatedLateFeeId: lateFee.id,
            },
          });
        }
      });
      logActivity({ userId: req.user.id, action: 'rental.return', entityType: 'RentalOrder', entityId: id, metadata: { lateFees: lateFeesCalculated.toString() } });
      return ok(res, { message: 'Return processed.', data: { status: 'RETURNED', lateFeesCalculated: lateFeesCalculated.toFixed(2) } });
    }

    case 'INSPECT': {
      // Mark damage on the return event
      const { conditionNotes, damageFlag } = req.body;
      const returnEvt = order.events.find((e) => e.eventType === 'RETURN');
      if (returnEvt) {
        await prisma.rentalEvent.update({
          where: { id: returnEvt.id },
          data: { conditionNotes: conditionNotes || 'Damage reported', damageFlag: damageFlag ?? true, inspectedById: req.user.id },
        });
      }
      if (damageFlag) {
        for (const line of order.lines) {
          await prisma.productUnit.update({
            where: { id: line.productUnitId },
            data: { status: 'DAMAGED', condition: 'DAMAGED', notes: conditionNotes },
          });
        }
      }
      return ok(res, { message: 'Inspection recorded.', data: { damageFlag } });
    }

    case 'SETTLE': {
      if (order.status !== 'RETURNED') {
        return fail(res, { status: 400, message: 'Order must be RETURNED to settle deposit.' });
      }
      const heldEntries = order.depositLedger.filter((e) => e.entryType === 'HELD');
      const deductedEntries = order.depositLedger.filter((e) => e.entryType === 'DEDUCTED');
      const refundedEntries = order.depositLedger.filter((e) => e.entryType === 'REFUNDED');
      const amountHeld = heldEntries.reduce((acc, e) => acc + parseFloat(e.amount), 0);
      const amountDeducted = deductedEntries.reduce((acc, e) => acc + parseFloat(e.amount), 0);
      const amountRefunded = refundedEntries.reduce((acc, e) => acc + parseFloat(e.amount), 0);
      const balance = amountHeld - amountDeducted - amountRefunded;

      await prisma.$transaction(async (tx) => {
        if (balance > 0) {
          await tx.depositLedger.create({
            data: {
              orderId: id, entryType: 'REFUNDED',
              amount: balance,
              reason: 'Deposit refunded on order close',
            },
          });
        }
        await tx.rentalOrder.update({ where: { id }, data: { status: 'CLOSED' } });
      });
      logActivity({ userId: req.user.id, action: 'rental.settle', entityType: 'RentalOrder', entityId: id, metadata: { refund: balance.toFixed(2) } });
      return ok(res, { message: 'Deposit settled. Order closed.', data: { status: 'CLOSED', refundedAmount: balance.toFixed(2) } });
    }

    default:
      return fail(res, { status: 400, message: `Unknown action: ${action}` });
  }
}
