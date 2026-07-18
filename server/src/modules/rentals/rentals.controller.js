import crypto from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { ok, fail, AppError } from '../../lib/apiResponse.js';
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
    status: order.status,
    fulfillmentMethod: order.fulfillmentMethod,
    rentalStart: order.rentalStart,
    rentalEnd: order.rentalEnd,
    actualReturnTime: order.actualReturnTime,
    totalBaseCost: order.total.toString(),
    totalDeposit: order.depositTotal.toString(),
    totalPenalties: order.totalPenalties?.toString() || '0.00',
    createdAt: order.createdAt,
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

  // Fetch settings and pricelist.
  const settings = await prisma.rentalSettings.findFirst({ where: { isActive: true } });

  // NULL-GUARD (latent-bug fix). Previously this read ONLY `{ isDefault: true }` and then used
  // `pricelist.id` with no null check. Failure mode: the moment a store has no default pricelist —
  // which becomes reachable now that admins can create pricelists via /api/admin without flagging
  // one default — `pricelist` is null and `pricelist.id` throws a TypeError, surfacing as a generic
  // 500 with no useful message to the customer mid-checkout. Guard: resolve default → first active
  // (mirroring catalog.controller's defaultPricelistId so pricing and availability agree on the same
  // list), and if there is genuinely no usable pricelist, fail with a clean, explained 422 instead
  // of a 500. The seed always creates a default, so the happy path is unchanged.
  const pricelist =
    (await prisma.pricelist.findFirst({ where: { isDefault: true } })) ??
    (await prisma.pricelist.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }));
  if (!pricelist) {
    return fail(res, {
      status: 422,
      message: 'No active pricelist is configured. An administrator must create one before quotations can be priced.',
    });
  }

  const durationMs = end.getTime() - start.getTime();
  const durationDays = Math.ceil(durationMs / (24 * 60 * 60 * 1000));

  const orderNumber = `RO-2026-${Date.now().toString().slice(-6)}`;

  const order = await prisma.$transaction(async (tx) => {
    let subtotal = 0;
    let depositTotal = 0;

    const lineItems = [];

    for (const item of items) {
      const unit = await tx.productUnit.findUnique({
        where: { id: item.assetId },
        include: { product: true },
      });

      if (!unit) {
        // AppError (not a bare Error) so the central handler returns a clean status instead of a
        // 500 with a stack. See lib/apiResponse.js + middleware/errorHandler.js.
        throw new AppError(`Asset not found: ${item.assetId}`, 404);
      }

      if (unit.status !== 'AVAILABLE') {
        // Race guard: availability now only offers AVAILABLE units, but if one is taken between
        // the check and here, return 409 (the client re-checks) rather than a 500.
        throw new AppError(`${unit.serialNumber} is no longer available for these dates.`, 409);
      }

      // Check rates from pricelist
      const pricelistItem = await tx.pricelistItem.findFirst({
        where: {
          pricelistId: pricelist.id,
          productId: unit.productId,
          durationUnit: 'DAILY',
        },
      });

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

  // Pickup is allowed only after verified payment confirmation. A quotation must never reach
  // handover just because the client claims checkout succeeded.
  if (order.status !== 'CONFIRMED') {
    return fail(res, { status: 400, message: 'Only confirmed orders can be handed over.' });
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

      // Reservation is already ACTIVE from verified payment confirmation; keep the operation
      // idempotent if a historical row is still HELD.
      await tx.reservation.updateMany({
        where: { orderId: id, productUnitId: line.productUnitId, status: 'HELD' },
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
