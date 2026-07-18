/**
 * GET /api/rentals/:id — full order detail. ADDITIVE (kept in its own file so the teammate's
 * rentals.controller is untouched). Demo-path-required: the customer/admin order-detail screens
 * need line items, and admin handover/return need the unit serial numbers ("barcodes") to scan —
 * none of which the list endpoint returns.
 *
 * Ownership: a CUSTOMER may only read their own order (404 otherwise — no existence leak). Admin
 * reads any. Deposit balance is DERIVED from the ledger (no balance column), consistent with the
 * schema's append-only design.
 */
import { prisma } from '../../config/prisma.js';
import { ok, fail } from '../../lib/apiResponse.js';

const money = (d) => Number(d ?? 0).toFixed(2);

export async function getRentalById(req, res) {
  const { id } = req.params;

  const order = await prisma.rentalOrder.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      lines: { include: { product: { select: { name: true } }, productUnit: { select: { serialNumber: true } } } },
      depositLedger: { orderBy: { createdAt: 'asc' } },
      lateFees: true,
      events: { orderBy: { scheduledAt: 'asc' } },
      payments: { orderBy: { createdAt: 'asc' } },
      invoices: true,
    },
  });

  if (!order) return fail(res, { status: 404, message: 'Order not found.' });

  // Ownership scope (IDOR defence): customers only see their own orders.
  if (req.user.role !== 'ADMIN' && order.customerId !== req.user.id) {
    return fail(res, { status: 404, message: 'Order not found.' });
  }

  const held = order.depositLedger.filter((e) => e.entryType === 'HELD').reduce((a, e) => a + Number(e.amount), 0);
  const deducted = order.depositLedger.filter((e) => e.entryType === 'DEDUCTED').reduce((a, e) => a + Number(e.amount), 0);
  const refunded = order.depositLedger.filter((e) => e.entryType === 'REFUNDED').reduce((a, e) => a + Number(e.amount), 0);
  const balance = held - deducted - refunded;

  return ok(res, {
    message: 'Order detail',
    data: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      fulfillmentMethod: order.fulfillmentMethod,
      rentalStart: order.rentalStart,
      rentalEnd: order.rentalEnd,
      actualReturnTime: order.actualReturnTime,
      subtotal: money(order.subtotal),
      total: money(order.total),
      depositTotal: money(order.depositTotal),
      totalPenalties: order.totalPenalties != null ? money(order.totalPenalties) : '0.00',
      currency: order.currency,
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      cancelledAt: order.cancelledAt,
      customer: order.customer ? { id: order.customer.id, name: order.customer.name, email: order.customer.email } : null,
      lines: order.lines.map((l) => ({
        id: l.id,
        productName: l.product?.name ?? '—',
        serialNumber: l.productUnit?.serialNumber ?? '—',
        durationUnit: l.durationUnit,
        durationCount: l.durationCount,
        rateApplied: money(l.rateApplied),
        lineSubtotal: money(l.lineSubtotal),
      })),
      deposit: {
        amountHeld: money(held),
        amountDeducted: money(deducted),
        amountRefunded: money(refunded),
        balance: money(balance),
        status: balance <= 0 && held > 0 ? 'SETTLED' : held > 0 ? 'HELD' : 'NONE',
        ledger: order.depositLedger.map((e) => ({
          id: e.id,
          entryType: e.entryType,
          amount: money(e.amount),
          reason: e.reason,
          createdAt: e.createdAt,
        })),
      },
      lateFees: order.lateFees.map((f) => ({
        id: f.id,
        amount: money(f.amount),
        daysLate: f.daysLate,
        ruleType: f.ruleType,
        ruleValue: money(f.ruleValue),
        graceHours: f.graceHours,
        capAmount: money(f.capAmount),
      })),
      events: order.events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        scheduledAt: e.scheduledAt,
        actualAt: e.actualAt,
        damageFlag: e.damageFlag,
      })),
      payments: order.payments.map((p) => ({
        id: p.id,
        amount: money(p.amount),
        purpose: p.purpose,
        status: p.status,
        reference: p.reference,
        createdAt: p.createdAt,
      })),
      invoices: order.invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        status: i.status,
        amount: money(i.amount),
        issuedAt: i.issuedAt,
      })),
    },
  });
}
