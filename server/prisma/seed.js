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
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { SEED_DIR, UPLOADS_ROOT } from '../src/lib/uploads.js';

// Tracked, committed real product photos (populated by scripts/fetch-seed-images.js).
const SEED_ASSETS_DIR = path.resolve(UPLOADS_ROOT, '../seed-assets/products');
const PHOTO_EXTS = ['jpg', 'jpeg', 'png', 'webp'];

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// SEED IMAGES — copied LOCALLY into server/uploads/seed/ on every run.
// WHY COPY INTO uploads/ INSTEAD OF READING seed-assets/ DIRECTLY AT RUNTIME:
//   server/uploads is the one static mount the app already serves; keeping both seeded images and
//   admin-uploaded images under that tree means the client consumes one URL shape: /uploads/<path>.
//   The COMMITTED source of truth for seeded product photos is server/seed-assets/products/, filled
//   manually by scripts/fetch-seed-images.js. Seeding copies those tracked bytes into uploads/ so a
//   fresh clone stays fully offline. If a photo is missing, we generate a deterministic SVG fallback
//   so the catalogue still renders instead of breaking.
// ---------------------------------------------------------------------------
const escapeXml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

function hueFor(key) {
  return parseInt(createHash('sha1').update(key).digest('hex').slice(0, 2), 16) * (360 / 255);
}

// A tidy gradient card with the product name + category. Deterministic colour from the product key,
// so the same product always gets the same look across runs.
function productSvg(key, name, categoryName) {
  const h = Math.round(hueFor(key));
  const h2 = Math.round((h + 40) % 360);
  const words = escapeXml(name).split(' ');
  // Wrap the name to at most 2 lines so long names stay inside the card.
  const mid = Math.ceil(words.length / 2);
  const line1 = words.length > 3 ? words.slice(0, mid).join(' ') : escapeXml(name);
  const line2 = words.length > 3 ? words.slice(mid).join(' ') : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400" role="img" aria-label="${escapeXml(name)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${h} 62% 55%)"/>
      <stop offset="1" stop-color="hsl(${h2} 58% 38%)"/>
    </linearGradient>
  </defs>
  <rect width="600" height="400" fill="url(#g)"/>
  <circle cx="500" cy="80" r="140" fill="rgba(255,255,255,0.08)"/>
  <circle cx="90" cy="340" r="110" fill="rgba(0,0,0,0.08)"/>
  <text x="40" y="70" font-family="Segoe UI, Arial, sans-serif" font-size="20" fill="rgba(255,255,255,0.85)" letter-spacing="2">${escapeXml(categoryName.toUpperCase())}</text>
  <text x="40" y="210" font-family="Segoe UI, Arial, sans-serif" font-size="46" font-weight="700" fill="#ffffff">${line1}</text>
  ${line2 ? `<text x="40" y="266" font-family="Segoe UI, Arial, sans-serif" font-size="46" font-weight="700" fill="#ffffff">${line2}</text>` : ''}
  <text x="40" y="360" font-family="Segoe UI, Arial, sans-serif" font-size="18" fill="rgba(255,255,255,0.75)">Zenith Rentals</text>
</svg>`;
}

// Resolve a product's seed image and return its stored relative path (under /uploads).
// PREFERS a real committed photo from seed-assets/ (copied into uploads/ — a pure local file copy,
// so this stays fully OFFLINE); FALLS BACK to a generated SVG placeholder if no photo exists, so a
// missing/failed download never breaks the catalogue. Photos are fetched out-of-band by the manual
// scripts/fetch-seed-images.js — never here, never at runtime.
function writeSeedImage(key, name, categoryName) {
  fs.mkdirSync(SEED_DIR, { recursive: true });
  for (const ext of [...PHOTO_EXTS, 'svg']) {
    const stale = path.join(SEED_DIR, `${key}.${ext}`);
    if (fs.existsSync(stale)) fs.rmSync(stale);
  }
  for (const ext of PHOTO_EXTS) {
    const src = path.join(SEED_ASSETS_DIR, `${key}.${ext}`);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(SEED_DIR, `${key}.${ext}`));
      return `seed/${key}.${ext}`;
    }
  }
  fs.writeFileSync(path.join(SEED_DIR, `${key}.svg`), productSvg(key, name, categoryName), 'utf8');
  return `seed/${key}.svg`;
}

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

// 8 categories (>= the required 6). The first three keys (electronics/construction/event) are
// PRESERVED because the curated demo orders A–G reference products in them by key.
const CATEGORIES = [
  { key: 'electronics', name: 'Electronics', slug: 'electronics' },
  { key: 'construction', name: 'Construction Equipment', slug: 'construction' },
  { key: 'event', name: 'Event & Party', slug: 'event-party' },
  { key: 'photography', name: 'Photography', slug: 'photography' },
  { key: 'audio', name: 'Audio & Sound', slug: 'audio-sound' },
  { key: 'outdoor', name: 'Outdoor & Camping', slug: 'outdoor-camping' },
  { key: 'tools', name: 'Power Tools', slug: 'power-tools' },
  { key: 'furniture', name: 'Furniture', slug: 'furniture' },
];

// 37 products (>= the required 25), multiple units each. The first six keys are PRESERVED unchanged
// (dslr/projector/drill/mixer/table/speaker) — the demo orders reference their units by key, so they
// must keep the same ids and unit counts. Everything after is new catalogue depth: realistic names,
// descriptions, brands, and DAILY/WEEKLY rates that make the storefront read as a real store.
const PRODUCTS = [
  // --- Electronics (first two are demo-referenced) ---
  { key: 'dslr', name: 'DSLR Camera Kit', cat: 'electronics', brand: 'Canon', manufacturer: 'Canon Inc.', color: 'Black', size: 'Kit', daily: 1200, weekly: 6000, units: 3, description: 'Full-frame DSLR body with 24-70mm lens, two batteries, and a 64GB card. Ready for weddings, shoots, and events.' },
  { key: 'projector', name: '4K Projector', cat: 'electronics', brand: 'Epson', manufacturer: 'Seiko Epson', color: 'White', size: 'Standard', daily: 900, weekly: 4500, units: 2, description: '3500-lumen 4K home-cinema projector with HDMI and wireless casting. Screen up to 300 inches.' },
  { key: 'laptop', name: 'Business Laptop', cat: 'electronics', brand: 'Dell', manufacturer: 'Dell Technologies', color: 'Silver', size: '15in', daily: 1000, weekly: 5000, units: 3, description: 'Core i7, 16GB RAM, 512GB SSD. Pre-loaded with office and presentation software for conferences.' },
  { key: 'tablet', name: 'Drawing Tablet Pro', cat: 'electronics', brand: 'Wacom', manufacturer: 'Wacom Co.', color: 'Black', size: '16in', daily: 500, weekly: 2500, units: 3, description: 'Pressure-sensitive pen display for illustrators and designers, with stand and express keys.' },
  { key: 'monitor', name: '27in 4K Monitor', cat: 'electronics', brand: 'LG', manufacturer: 'LG Electronics', color: 'Black', size: '27in', daily: 400, weekly: 2000, units: 2, description: 'Colour-accurate 4K IPS monitor with USB-C. Ideal for editing suites and demo booths.' },

  // --- Construction (first two are demo-referenced) ---
  { key: 'drill', name: 'Cordless Hammer Drill', cat: 'construction', brand: 'Bosch', manufacturer: 'Robert Bosch GmbH', color: 'Blue', size: '18V', daily: 400, weekly: 2000, units: 2, description: '18V brushless hammer drill with two batteries, charger, and bit set. Concrete, masonry, and wood.' },
  { key: 'mixer', name: 'Concrete Mixer', cat: 'construction', brand: 'Generac', manufacturer: 'Generac Power', color: 'Orange', size: '120L', daily: 1500, weekly: 7500, units: 2, description: '120-litre electric drum mixer on wheels. Mixes concrete, mortar, and plaster on site.' },
  { key: 'generator', name: 'Portable Generator 5kW', cat: 'construction', brand: 'Honda', manufacturer: 'Honda Power', color: 'Red', size: '5kW', daily: 2000, weekly: 10000, units: 2, description: 'Quiet 5kW petrol inverter generator. Powers tools, lighting rigs, and event stalls.' },
  { key: 'jackhammer', name: 'Electric Jackhammer', cat: 'construction', brand: 'Makita', manufacturer: 'Makita Corp.', color: 'Teal', size: '1500W', daily: 1800, weekly: 9000, units: 2, description: '1500W demolition hammer with chisel and point bits. Breaks concrete, tile, and asphalt.' },
  { key: 'scaffold', name: 'Scaffold Tower Set', cat: 'construction', brand: 'Youngman', manufacturer: 'Youngman Group', color: 'Grey', size: '4m', daily: 1200, weekly: 6000, units: 2, description: 'Aluminium mobile scaffold tower reaching 4m platform height, with guardrails and stabilisers.' },
  { key: 'washer', name: 'Pressure Washer', cat: 'construction', brand: 'Karcher', manufacturer: 'Alfred Kärcher SE', color: 'Yellow', size: '2000PSI', daily: 700, weekly: 3500, units: 3, description: '2000 PSI electric pressure washer with lance and rotary nozzle. Driveways, facades, machinery.' },

  // --- Event & Party (first two are demo-referenced) ---
  { key: 'table', name: 'Round Banquet Table', cat: 'event', brand: 'Lifetime', manufacturer: 'Lifetime Products', color: 'White', size: '60in', daily: 150, weekly: 700, units: 3, description: 'Seats 8–10. Fold-flat 60-inch round banquet table for weddings and corporate dinners.' },
  { key: 'speaker', name: 'Portable PA Speaker', cat: 'event', brand: 'JBL', manufacturer: 'Harman', color: 'Black', size: '15in', daily: 600, weekly: 3000, units: 2, description: 'Battery-powered 15-inch PA speaker with wireless mic and Bluetooth. Up to 12 hours runtime.' },
  { key: 'tent', name: 'Party Tent 6x3m', cat: 'event', brand: 'Coleman', manufacturer: 'The Coleman Company', color: 'White', size: '6x3m', daily: 2500, weekly: 12000, units: 2, description: 'Waterproof 6x3m marquee with removable side walls. Seats 40 guests for outdoor functions.' },
  { key: 'chairs', name: 'Folding Chair Set (10)', cat: 'event', brand: 'Lifetime', manufacturer: 'Lifetime Products', color: 'White', size: 'Set of 10', daily: 300, weekly: 1500, units: 4, description: 'Ten stackable padded folding chairs. Indoor or outdoor event seating.' },
  { key: 'uplights', name: 'LED Uplighting Kit', cat: 'event', brand: 'Chauvet', manufacturer: 'Chauvet DJ', color: 'Black', size: 'Kit of 8', daily: 800, weekly: 4000, units: 3, description: 'Eight wireless RGB LED uplights with remote. Colour-wash a venue in seconds.' },
  { key: 'popcorn', name: 'Popcorn Machine', cat: 'event', brand: 'Great Northern', manufacturer: 'Great Northern Popcorn', color: 'Red', size: '8oz', daily: 900, weekly: 4500, units: 2, description: 'Vintage-style 8oz cart popcorn machine. A crowd favourite for fairs and parties.' },

  // --- Photography ---
  { key: 'gimbal', name: '3-Axis Gimbal Stabilizer', cat: 'photography', brand: 'DJI', manufacturer: 'DJI', color: 'Grey', size: 'Pro', daily: 700, weekly: 3500, units: 3, description: 'Motorised 3-axis gimbal for mirrorless and DSLR cameras. Buttery-smooth handheld footage.' },
  { key: 'lens', name: '70-200mm Telephoto Lens', cat: 'photography', brand: 'Canon', manufacturer: 'Canon Inc.', color: 'White', size: 'f/2.8', daily: 900, weekly: 4500, units: 2, description: 'Fast f/2.8 telephoto zoom with image stabilisation. Sports, wildlife, and portraits.' },
  { key: 'lightkit', name: 'Studio Lighting Kit', cat: 'photography', brand: 'Godox', manufacturer: 'Godox Photo Equipment', color: 'Black', size: '3-Light', daily: 600, weekly: 3000, units: 3, description: 'Three-head continuous LED studio kit with softboxes and stands. Product and portrait work.' },
  { key: 'tripod', name: 'Carbon Fiber Tripod', cat: 'photography', brand: 'Manfrotto', manufacturer: 'Vitec Imaging', color: 'Black', size: '160cm', daily: 250, weekly: 1250, units: 4, description: 'Lightweight carbon-fibre tripod with fluid head. Stable to 160cm, folds to 45cm.' },
  { key: 'drone', name: 'Aerial Camera Drone', cat: 'photography', brand: 'DJI', manufacturer: 'DJI', color: 'Grey', size: '4K', daily: 1500, weekly: 7500, units: 2, description: '4K aerial drone with 3-axis gimbal, 30-minute flight time, and spare batteries.' },

  // --- Audio & Sound ---
  { key: 'audiomixer', name: '12-Channel Audio Mixer', cat: 'audio', brand: 'Yamaha', manufacturer: 'Yamaha Corp.', color: 'Black', size: '12-Ch', daily: 800, weekly: 4000, units: 2, description: '12-channel analog mixing console with built-in effects. Live bands and conferences.' },
  { key: 'microphone', name: 'Wireless Microphone Set', cat: 'audio', brand: 'Shure', manufacturer: 'Shure Inc.', color: 'Black', size: 'Dual', daily: 500, weekly: 2500, units: 4, description: 'Dual handheld wireless microphone system with receiver. Rock-solid for speeches and karaoke.' },
  { key: 'headphones', name: 'Studio Monitor Headphones', cat: 'audio', brand: 'Sony', manufacturer: 'Sony Corp.', color: 'Black', size: 'Over-ear', daily: 200, weekly: 1000, units: 5, description: 'Reference over-ear headphones for mixing and monitoring. Flat, honest sound.' },
  { key: 'subwoofer', name: 'Powered Subwoofer 18in', cat: 'audio', brand: 'JBL', manufacturer: 'Harman', color: 'Black', size: '18in', daily: 900, weekly: 4500, units: 2, description: '18-inch active subwoofer adding deep low-end to any PA. Club nights and large venues.' },

  // --- Outdoor & Camping ---
  { key: 'kayak', name: '2-Person Kayak', cat: 'outdoor', brand: 'Intex', manufacturer: 'Intex Recreation', color: 'Yellow', size: '2-Person', daily: 1000, weekly: 5000, units: 3, description: 'Inflatable two-person kayak with paddles and pump. Lakes, calm rivers, and coastlines.' },
  { key: 'campstove', name: 'Camping Stove & Cookset', cat: 'outdoor', brand: 'Coleman', manufacturer: 'The Coleman Company', color: 'Green', size: '2-Burner', daily: 300, weekly: 1500, units: 4, description: 'Two-burner propane camp stove with nesting cookware. Feeds a group in the field.' },
  { key: 'cooler', name: 'Heavy-Duty Cooler 60L', cat: 'outdoor', brand: 'Igloo', manufacturer: 'Igloo Products', color: 'Blue', size: '60L', daily: 250, weekly: 1250, units: 3, description: 'Rotomoulded 60-litre cooler holding ice for up to 5 days. Camping, fishing, and events.' },
  { key: 'ebike', name: 'Electric Mountain Bike', cat: 'outdoor', brand: 'Rad Power', manufacturer: 'Rad Power Bikes', color: 'Black', size: 'Large', daily: 1400, weekly: 7000, units: 3, description: 'Pedal-assist e-MTB with 80km range and helmet. Trails, tours, and city exploring.' },

  // --- Power Tools ---
  { key: 'mitersaw', name: 'Compound Miter Saw', cat: 'tools', brand: 'DeWalt', manufacturer: 'Stanley Black & Decker', color: 'Yellow', size: '12in', daily: 600, weekly: 3000, units: 2, description: '12-inch sliding compound miter saw with stand. Precise cross and bevel cuts in timber.' },
  { key: 'sander', name: 'Orbital Floor Sander', cat: 'tools', brand: 'Bosch', manufacturer: 'Robert Bosch GmbH', color: 'Blue', size: 'Floor', daily: 1100, weekly: 5500, units: 2, description: 'Random-orbital floor sander with dust collection. Refinish hardwood floors quickly.' },
  { key: 'welder', name: 'MIG Welder 200A', cat: 'tools', brand: 'Hobart', manufacturer: 'Hobart Brothers', color: 'Grey', size: '200A', daily: 1300, weekly: 6500, units: 2, description: '200-amp MIG welder with regulator and wire. Fabrication, repairs, and metalwork.' },
  { key: 'ladder', name: 'Extension Ladder 24ft', cat: 'tools', brand: 'Werner', manufacturer: 'Werner Co.', color: 'Silver', size: '24ft', daily: 350, weekly: 1750, units: 3, description: 'Aluminium 24ft extension ladder rated to 150kg. Painting, roofing, and maintenance.' },

  // --- Furniture ---
  { key: 'sofa', name: 'Event Lounge Sofa', cat: 'furniture', brand: 'IKEA', manufacturer: 'Inter IKEA Systems', color: 'Grey', size: '3-Seat', daily: 1200, weekly: 6000, units: 2, description: 'Modern three-seat lounge sofa for VIP areas, green rooms, and exhibition stands.' },
  { key: 'barstool', name: 'Bar Stool Set (4)', cat: 'furniture', brand: 'CB2', manufacturer: 'Crate & Barrel', color: 'Walnut', size: 'Set of 4', daily: 400, weekly: 2000, units: 3, description: 'Four mid-century bar stools with footrest. Cocktail bars and high-top event tables.' },
  { key: 'podium', name: 'Presentation Podium', cat: 'furniture', brand: 'Oklahoma Sound', manufacturer: 'Oklahoma Sound Corp.', color: 'Black', size: 'Standard', daily: 700, weekly: 3500, units: 2, description: 'Floor-standing lectern with shelf and cable pass-through. Keynotes and ceremonies.' },
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
  const categoryNameByKey = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.name]));
  for (const p of PRODUCTS) {
    const id = uuidFor(`product:${p.key}`);
    const data = { categoryId: uuidFor(`category:${p.cat}`), name: p.name, description: p.description ?? null, brand: p.brand, manufacturer: p.manufacturer, color: p.color, size: p.size, sku: `SKU-${p.key.toUpperCase()}` };
    await prisma.product.upsert({ where: { id }, update: data, create: { id, ...data } });

    // Primary product image — copied from the committed seed-assets photo when present, else a
    // deterministic SVG fallback. Deterministic id keeps it idempotent; the partial unique index
    // allows exactly this one primary image row.
    const imgId = uuidFor(`image:${p.key}`);
    const imgPath = writeSeedImage(p.key, p.name, categoryNameByKey[p.cat] ?? '');
    await prisma.productImage.upsert({
      where: { id: imgId },
      update: { productId: id, path: imgPath, isPrimary: true, sortOrder: 0 },
      create: { id: imgId, productId: id, path: imgPath, isPrimary: true, sortOrder: 0 },
    });

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
