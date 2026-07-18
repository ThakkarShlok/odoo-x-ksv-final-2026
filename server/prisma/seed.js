/**
 * Rental Management System — idempotent seed.
 *
 * IDEMPOTENCY: every row has a DETERMINISTIC id derived from a semantic name via uuidFor(name).
 * Re-running upserts the same ids, so a second run updates in place — no duplicates. Reservations
 * (whose tsrange column Prisma cannot write) use INSERT ... ON CONFLICT (id) DO UPDATE in raw SQL.
 * The demo dates are recomputed relative to "now" on every run ON PURPOSE, so "due today" stays
 * today and "overdue" stays overdue at demo time.
 *
 * INSERT ORDERING is load-bearing:
 *   - LateFee is written BEFORE the DepositLedger DEDUCTED row that references it.
 *   - DepositLedger entries are written HELD → DEDUCTED → REFUNDED, because the balance trigger
 *     (migration 004) rejects any withdrawal that would exceed the running held balance.
 *
 * DEMO DATA covers every state a reviewer will look for:
 *   A active (IN_RENTAL) · B due today · C overdue · D closed on-time (full refund)
 *   E closed late (penalty deducted, remainder refunded) · F confirmed (upcoming pickup) · G quotation.
 *
 * The demo passwords are public, weak, and committed on purpose — they are NOT secrets.
 */
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Deterministic UUID from a name: stable across runs (idempotency) and readable at the call site.
// @db.Uuid accepts any well-formed UUID string; RFC version/variant bits are irrelevant to storage.
function uuidFor(name) {
  const h = createHash('sha1').update(name).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// Preserve the boilerplate admin row (its id predates this seed) by upserting on that exact id.
const ADMIN_ID = '00000000-0000-4000-8000-000000000001';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const at = (offsetDays, hour = 12) => {
  const d = new Date(now.getTime() + offsetDays * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const pad = (n) => String(n).padStart(2, '0');
// tsrange literal wants 'YYYY-MM-DD HH:MM:SS' (timestamp without tz). Local wall-clock is fine —
// reservations only need internal consistency for the per-unit no-overlap check.
const ts = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

// ---------------------------------------------------------------------------
// MASTER DATA
// ---------------------------------------------------------------------------
const USERS = [
  { id: ADMIN_ID, email: 'admin@zenith.dev', name: 'Ada Admin', role: 'ADMIN', password: 'admin12345' },
  { id: uuidFor('user:alice'), email: 'alice@zenith.dev', name: 'Alice Renter', role: 'CUSTOMER', password: 'customer12345' },
  { id: uuidFor('user:bob'), email: 'bob@zenith.dev', name: 'Bob Renter', role: 'CUSTOMER', password: 'customer12345' },
];

const ADDRESSES = [
  { key: 'alice-ship', userKey: 'user:alice', type: 'SHIPPING', label: 'Home', line1: '12 MG Road', city: 'Ahmedabad', state: 'Gujarat', postalCode: '380001', isDefault: true },
  { key: 'alice-bill', userKey: 'user:alice', type: 'BILLING', label: 'Office', line1: '400 SG Highway', city: 'Ahmedabad', state: 'Gujarat', postalCode: '380015', isDefault: false },
  { key: 'bob-ship', userKey: 'user:bob', type: 'SHIPPING', label: 'Home', line1: '7 Nehru Nagar', city: 'Surat', state: 'Gujarat', postalCode: '395007', isDefault: true },
];

const CATEGORIES = [
  { key: 'electronics', name: 'Electronics', slug: 'electronics' },
  { key: 'construction', name: 'Construction Equipment', slug: 'construction' },
  { key: 'event', name: 'Event & Party', slug: 'event-party' },
];

const PRODUCTS = [
  { key: 'dslr', name: 'DSLR Camera Kit', cat: 'electronics', brand: 'Canon', manufacturer: 'Canon Inc.', color: 'Black', size: 'Kit', daily: 1200, weekly: 6000, units: 3 },
  { key: 'projector', name: '4K Projector', cat: 'electronics', brand: 'Epson', manufacturer: 'Seiko Epson', color: 'White', size: 'Standard', daily: 900, weekly: 4500, units: 2 },
  { key: 'drill', name: 'Cordless Hammer Drill', cat: 'construction', brand: 'Bosch', manufacturer: 'Robert Bosch GmbH', color: 'Blue', size: '18V', daily: 400, weekly: 2000, units: 2 },
  { key: 'mixer', name: 'Concrete Mixer', cat: 'construction', brand: 'Generac', manufacturer: 'Generac Power', color: 'Orange', size: '120L', daily: 1500, weekly: 7500, units: 2 },
  { key: 'table', name: 'Round Banquet Table', cat: 'event', brand: 'Lifetime', manufacturer: 'Lifetime Products', color: 'White', size: '60in', daily: 150, weekly: 700, units: 3 },
  { key: 'speaker', name: 'Portable PA Speaker', cat: 'event', brand: 'JBL', manufacturer: 'Harman', color: 'Black', size: '15in', daily: 600, weekly: 3000, units: 2 },
];

const PRICELIST = { key: 'standard', name: 'Standard 2026', isDefault: true, isActive: true };

const SETTINGS = {
  key: 'default',
  name: 'Default Org Settings',
  isActive: true,
  depositRuleType: 'PERCENTAGE',
  depositValue: 20, // 20% of rental subtotal
  gracePeriodHours: 24,
  lateFeeRuleType: 'PER_DAY_FLAT',
  lateFeeValue: 500, // Rs 500 / day late
  maxLateFeeCap: 5000,
};

// ---------------------------------------------------------------------------
// ORDERS — each references a product + a specific unit number. Units are distinct across all
// live reservations, so the EXCLUDE constraint is satisfied without any overlap gymnastics.
// ---------------------------------------------------------------------------
const ORDERS = [
  { key: 'A', customer: 'user:alice', product: 'dslr', unit: 1, status: 'IN_RENTAL', startOff: -3, endOff: 4, fulfillment: 'STORE_PICKUP', reservation: 'ACTIVE', unitStatus: 'RENTED', invoice: 'ISSUED', events: [{ type: 'PICKUP', sched: -3, actual: -3 }], deposit: ['HELD'] },
  { key: 'B', customer: 'user:alice', product: 'drill', unit: 1, status: 'IN_RENTAL', startOff: -6, endOff: 0, endHour: 18, fulfillment: 'DELIVERY', address: 'alice-ship', reservation: 'ACTIVE', unitStatus: 'RENTED', invoice: 'ISSUED', events: [{ type: 'PICKUP', sched: -6, actual: -6 }, { type: 'RETURN', sched: 0, actual: null }], deposit: ['HELD'] },
  { key: 'C', customer: 'user:bob', product: 'projector', unit: 1, status: 'IN_RENTAL', startOff: -10, endOff: -2, fulfillment: 'STORE_PICKUP', reservation: 'ACTIVE', unitStatus: 'RENTED', invoice: 'ISSUED', events: [{ type: 'PICKUP', sched: -10, actual: -10 }, { type: 'RETURN', sched: -2, actual: null }], deposit: ['HELD'] },
  { key: 'D', customer: 'user:bob', product: 'table', unit: 1, status: 'CLOSED', startOff: -20, endOff: -14, fulfillment: 'STORE_PICKUP', reservation: 'FULFILLED', unitStatus: 'AVAILABLE', invoice: 'PAID', events: [{ type: 'PICKUP', sched: -20, actual: -20 }, { type: 'RETURN', sched: -14, actual: -14 }], deposit: ['HELD', 'REFUND_FULL'] },
  { key: 'E', customer: 'user:alice', product: 'dslr', unit: 2, status: 'CLOSED', startOff: -30, endOff: -23, fulfillment: 'DELIVERY', address: 'alice-ship', reservation: 'FULFILLED', unitStatus: 'AVAILABLE', invoice: 'PAID', events: [{ type: 'PICKUP', sched: -30, actual: -30 }, { type: 'RETURN', sched: -23, actual: -20, damage: false }], lateFee: { daysLate: 3, amount: 1500 }, deposit: ['HELD', 'DEDUCT_LATEFEE', 'REFUND_REMAINDER'] },
  { key: 'F', customer: 'user:alice', product: 'mixer', unit: 1, status: 'CONFIRMED', startOff: 2, endOff: 6, fulfillment: 'STORE_PICKUP', reservation: 'ACTIVE', unitStatus: 'RENTED', invoice: 'ISSUED', events: [{ type: 'PICKUP', sched: 2, actual: null }], deposit: ['HELD'] },
  { key: 'G', customer: 'user:alice', product: 'table', unit: 2, status: 'QUOTATION', startOff: 5, endOff: 8, fulfillment: 'STORE_PICKUP', reservation: 'HELD', unitStatus: 'RESERVED', invoice: null, events: [], deposit: [] },
];

async function main() {
  console.log('[seed] starting rental domain seed');

  // ---- Users ----
  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { id: u.id },
      update: { email: u.email, name: u.name, role: u.role, passwordHash },
      create: { id: u.id, email: u.email, name: u.name, role: u.role, passwordHash },
    });
  }
  console.log(`[seed] users: ${USERS.length}`);

  // ---- Addresses ----
  for (const a of ADDRESSES) {
    const id = uuidFor(`address:${a.key}`);
    const data = { userId: uuidFor(a.userKey), type: a.type, label: a.label, line1: a.line1, city: a.city, state: a.state, postalCode: a.postalCode, isDefault: a.isDefault };
    await prisma.address.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
  console.log(`[seed] addresses: ${ADDRESSES.length}`);

  // ---- Categories ----
  for (const c of CATEGORIES) {
    const id = uuidFor(`category:${c.key}`);
    await prisma.category.upsert({ where: { id }, update: { name: c.name, slug: c.slug }, create: { id, name: c.name, slug: c.slug } });
  }
  console.log(`[seed] categories: ${CATEGORIES.length}`);

  // ---- Products + Units ----
  let unitCount = 0;
  for (const p of PRODUCTS) {
    const id = uuidFor(`product:${p.key}`);
    const data = { categoryId: uuidFor(`category:${p.cat}`), name: p.name, brand: p.brand, manufacturer: p.manufacturer, color: p.color, size: p.size, sku: `SKU-${p.key.toUpperCase()}` };
    await prisma.product.upsert({ where: { id }, update: data, create: { id, ...data } });

    for (let i = 1; i <= p.units; i++) {
      const uid = uuidFor(`unit:${p.key}:${i}`);
      const serial = `SN-${p.key.toUpperCase()}-${pad(i)}`;
      // Unit status is (re)set from the order loop below for units that are on rent/reserved;
      // here we default them AVAILABLE so a re-run resets cleanly before order assignment.
      await prisma.productUnit.upsert({
        where: { id: uid },
        update: { productId: id, serialNumber: serial, status: 'AVAILABLE' },
        create: { id: uid, productId: id, serialNumber: serial, status: 'AVAILABLE' },
      });
      unitCount++;
    }
  }
  console.log(`[seed] products: ${PRODUCTS.length}, units: ${unitCount}`);

  // ---- Pricelist + items (DAILY + WEEKLY per product) ----
  const pricelistId = uuidFor(`pricelist:${PRICELIST.key}`);
  await prisma.pricelist.upsert({
    where: { id: pricelistId },
    update: { name: PRICELIST.name, isDefault: PRICELIST.isDefault, isActive: PRICELIST.isActive },
    create: { id: pricelistId, name: PRICELIST.name, isDefault: PRICELIST.isDefault, isActive: PRICELIST.isActive },
  });
  for (const p of PRODUCTS) {
    for (const [unit, rate] of [['DAILY', p.daily], ['WEEKLY', p.weekly]]) {
      const id = uuidFor(`pli:${p.key}:${unit}`);
      const data = { pricelistId, productId: uuidFor(`product:${p.key}`), durationUnit: unit, rate };
      await prisma.pricelistItem.upsert({ where: { id }, update: data, create: { id, ...data } });
    }
  }
  console.log(`[seed] pricelist items: ${PRODUCTS.length * 2}`);

  // ---- Rental settings (single active row) ----
  const settingsId = uuidFor(`settings:${SETTINGS.key}`);
  await prisma.rentalSettings.upsert({
    where: { id: settingsId },
    update: { name: SETTINGS.name, isActive: SETTINGS.isActive, depositRuleType: SETTINGS.depositRuleType, depositValue: SETTINGS.depositValue, gracePeriodHours: SETTINGS.gracePeriodHours, lateFeeRuleType: SETTINGS.lateFeeRuleType, lateFeeValue: SETTINGS.lateFeeValue, maxLateFeeCap: SETTINGS.maxLateFeeCap },
    create: { id: settingsId, name: SETTINGS.name, isActive: SETTINGS.isActive, depositRuleType: SETTINGS.depositRuleType, depositValue: SETTINGS.depositValue, gracePeriodHours: SETTINGS.gracePeriodHours, lateFeeRuleType: SETTINGS.lateFeeRuleType, lateFeeValue: SETTINGS.lateFeeValue, maxLateFeeCap: SETTINGS.maxLateFeeCap },
  });
  console.log('[seed] rental settings: 1');

  // ---- Orders and their financial/operational children ----
  for (const o of ORDERS) {
    const product = PRODUCTS.find((p) => p.key === o.product);
    const days = o.endOff - o.startOff;
    const rate = product.daily;
    const subtotal = rate * days;
    const total = subtotal;
    const deposit = Math.round(subtotal * (SETTINGS.depositValue / 100));

    const orderId = uuidFor(`order:${o.key}`);
    const unitId = uuidFor(`unit:${o.product}:${o.unit}`);
    const start = at(o.startOff);
    const end = at(o.endOff, o.endHour ?? 12);

    const orderData = {
      orderNumber: `RO-2026-${o.key}`,
      customerId: uuidFor(o.customer),
      status: o.status,
      fulfillmentMethod: o.fulfillment,
      deliveryAddressId: o.address ? uuidFor(`address:${o.address}`) : null,
      pricelistId,
      rentalStart: start,
      rentalEnd: end,
      subtotal,
      taxTotal: 0,
      total,
      depositTotal: o.deposit.length ? deposit : 0,
      confirmedAt: o.status === 'QUOTATION' ? null : start,
    };
    await prisma.rentalOrder.upsert({ where: { id: orderId }, update: orderData, create: { id: orderId, ...orderData } });

    // Single order line (one unit per order in this seed).
    const lineId = uuidFor(`line:${o.key}`);
    const lineData = { orderId, productId: uuidFor(`product:${o.product}`), productUnitId: unitId, durationUnit: 'DAILY', durationCount: days, rateApplied: rate, lineSubtotal: subtotal };
    await prisma.rentalOrderLine.upsert({ where: { id: lineId }, update: lineData, create: { id: lineId, ...lineData } });

    // Reservation — raw SQL because `during` is a tsrange Prisma cannot bind. Distinct unit per
    // live reservation keeps the EXCLUDE satisfied. ON CONFLICT keeps it idempotent.
    const resId = uuidFor(`res:${o.key}`);
    await prisma.$executeRawUnsafe(
      `INSERT INTO reservations (id, "orderId", "productUnitId", during, status, "createdAt", "updatedAt")
       VALUES ($1::uuid, $2::uuid, $3::uuid, tsrange($4::timestamp, $5::timestamp), $6::"ReservationStatus", now(), now())
       ON CONFLICT (id) DO UPDATE SET "orderId" = EXCLUDED."orderId", "productUnitId" = EXCLUDED."productUnitId",
         during = EXCLUDED.during, status = EXCLUDED.status, "updatedAt" = now()`,
      resId, orderId, unitId, ts(start), ts(end), o.reservation
    );

    // Unit status reflects the order it is committed to.
    await prisma.productUnit.update({ where: { id: unitId }, data: { status: o.unitStatus } });

    // Payments — only for confirmed-and-beyond orders (a quotation has collected nothing).
    if (o.status !== 'QUOTATION') {
      for (const [purpose, amount] of [['RENTAL', total], ['DEPOSIT', deposit]]) {
        const id = uuidFor(`pay:${o.key}:${purpose}`);
        const data = { orderId, amount, purpose, status: 'CAPTURED', method: 'card', processedAt: start };
        await prisma.payment.upsert({ where: { id }, update: data, create: { id, ...data } });
      }
    }

    // Late fee (order E) — written BEFORE the deposit DEDUCTED that references it. Carries the
    // rule snapshot; amount <= capAmount is enforced by the CHECK in migration 004.
    if (o.lateFee) {
      const id = uuidFor(`latefee:${o.key}`);
      const data = { orderId, orderLineId: lineId, amount: o.lateFee.amount, daysLate: o.lateFee.daysLate, ruleType: SETTINGS.lateFeeRuleType, ruleValue: SETTINGS.lateFeeValue, graceHours: SETTINGS.gracePeriodHours, capAmount: SETTINGS.maxLateFeeCap };
      await prisma.lateFee.upsert({ where: { id }, update: data, create: { id, ...data } });
    }

    // Deposit ledger — HELD → DEDUCTED → REFUNDED, in order, so the balance trigger never sees a
    // withdrawal exceed the held balance. Amounts computed to net exactly to zero where closed.
    //
    // INSERT-IF-ABSENT, not upsert: the ledger is APPEND-ONLY, and this is also what keeps the
    // seed idempotent. Prisma's upsert compiles to INSERT ... ON CONFLICT DO UPDATE, and Postgres
    // fires the BEFORE INSERT balance trigger on the *proposed* insert even when it resolves to an
    // UPDATE — which would double-count an existing withdrawal on a re-run and (correctly) trip the
    // trigger. Seeding an append-only table by re-inserting is the bug; inserting each entry once
    // is the fix, and it mirrors how real app code writes the ledger (create, never upsert).
    for (const entry of o.deposit) {
      const id = uuidFor(`ledger:${o.key}:${entry}`);
      if (await prisma.depositLedger.findUnique({ where: { id } })) continue; // already appended
      let entryType, amount, reason, relatedLateFeeId = null;
      if (entry === 'HELD') {
        entryType = 'HELD'; amount = deposit; reason = 'Security deposit held on confirmation';
      } else if (entry === 'REFUND_FULL') {
        entryType = 'REFUNDED'; amount = deposit; reason = 'On-time return — full deposit refunded';
      } else if (entry === 'DEDUCT_LATEFEE') {
        entryType = 'DEDUCTED'; amount = o.lateFee.amount; reason = 'Late-return penalty deducted from deposit'; relatedLateFeeId = uuidFor(`latefee:${o.key}`);
      } else if (entry === 'REFUND_REMAINDER') {
        entryType = 'REFUNDED'; amount = deposit - o.lateFee.amount; reason = 'Deposit balance refunded after penalty';
      }
      await prisma.depositLedger.create({ data: { id, orderId, entryType, amount, reason, relatedLateFeeId } });
    }

    // Invoice.
    if (o.invoice) {
      const id = uuidFor(`invoice:${o.key}`);
      const data = { orderId, invoiceNumber: `INV-2026-${o.key}`, status: o.invoice, amount: total, issuedAt: o.status === 'QUOTATION' ? null : start };
      await prisma.invoice.upsert({ where: { id }, update: data, create: { id, ...data } });
    }

    // Pickup / return events.
    for (const ev of o.events) {
      const id = uuidFor(`event:${o.key}:${ev.type}`);
      const data = {
        orderId,
        eventType: ev.type,
        scheduledAt: at(ev.sched, o.endHour && ev.type === 'RETURN' ? o.endHour : 12),
        actualAt: ev.actual === null || ev.actual === undefined ? null : at(ev.actual),
        damageFlag: Boolean(ev.damage),
        inspectedById: ev.actual != null ? ADMIN_ID : null,
      };
      await prisma.rentalEvent.upsert({ where: { id }, update: data, create: { id, ...data } });
    }

    console.log(`[seed] order RO-2026-${o.key} (${o.status})`);
  }

  console.log('[seed] done');
}

main()
  .catch((err) => {
    console.error('[seed] failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
