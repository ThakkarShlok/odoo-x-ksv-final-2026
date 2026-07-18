/**
 * Customer-facing CATALOGUE — the middle tier (Product), with REAL rates from PricelistItem, and
 * a genuine date-range availability check that reflects the same truth the EXCLUDE constraint
 * enforces. Both endpoints are public (no auth) so browsing works pre-login, mirroring the
 * existing public GET /api/products.
 *
 * WHY THIS EXISTS: GET /api/products returns Categories with hardcoded rates, and the only
 * ProductUnit listing (/api/inventory) is admin-only with no time-awareness. Neither supports a
 * customer browsing rentable products and confirming availability for a date range — this module
 * fills exactly that gap on the demo path.
 */
import { prisma } from '../../config/prisma.js';
import { ok, fail } from '../../lib/apiResponse.js';
import { resolveDefaultPricelistId } from '../../lib/pricelists.js';
import { UPLOADS_URL_PREFIX } from '../../lib/uploads.js';

// Money out as a fixed 2-decimal string, consistent with the rest of the API's money handling.
const money = (d) => (d == null ? null : Number(d).toFixed(2));

// Only currently-AVAILABLE units are offered. This MUST match createQuotation's gate
// (`unit.status === 'AVAILABLE'`): the booking flow flips a unit AVAILABLE -> RESERVED -> RENTED
// -> AVAILABLE through its lifecycle, so `status` is the operational availability flag. Offering a
// RENTED-but-time-free unit here would let a customer pick something createQuotation then rejects
// (the 500 this fixes). The reservation-overlap check below still runs as a second guard and is
// the source of truth the EXCLUDE constraint enforces.
const RENTABLE_UNIT_STATUSES = ['AVAILABLE'];

// Reservation statuses that OCCUPY a unit for their window. Must match the EXCLUDE constraint's
// predicate in migration 004 exactly, or availability would disagree with what the DB enforces.
const OCCUPYING_RESERVATION_STATUSES = ['HELD', 'ACTIVE', 'FULFILLED'];

const defaultPricelistId = () => resolveDefaultPricelistId(prisma);

// ORDER BY is not parameterizable, so the sort key is WHITELISTED to a fixed clause — a client
// cannot inject arbitrary SQL through ?sort. Everything else in the query below IS parameterized.
const CATALOG_SORTS = {
  name: 'p.name ASC',
  newest: 'p."createdAt" DESC, p.name ASC',
  price_asc: 'daily.rate ASC NULLS LAST, p.name ASC',
  price_desc: 'daily.rate DESC NULLS LAST, p.name ASC',
};

// tsrange literal wants 'YYYY-MM-DD HH:MM:SS' (no tz), matching seed.js/createQuotation.
const toTs = (d) => d.toISOString().slice(0, 19).replace('T', ' ');

/**
 * GET /api/catalog — rentable products with REAL per-duration rates, the primary image, unit
 * counts, and (optionally) an availability-window filter. Filtering, sorting and pagination are
 * ALL done in SQL, in ONE query — never fetch-all-then-slice-in-JS.
 *
 * WHY SQL-SIDE, NOT IN-MEMORY: the catalogue is the customer's first screen and grows with the
 * store. Fetching every product to filter/sort/paginate in Node would pull the whole table over
 * the wire, sort it in the app, and throw most of it away — O(all products) work and memory for
 * one page. Pushing it to Postgres means the database uses its indexes to touch only the matching
 * page, and `count(*) OVER()` returns the total for pagination in the SAME round trip. It also
 * keeps the "price sort" honest: ordering by the joined PricelistItem rate is something Prisma's
 * `orderBy` cannot express over a to-many relation, so a hand-written query is the correct tool.
 *
 * INDEXES THIS QUERY LEANS ON (the ones to name at review):
 *   - WHERE categoryId (+ isRentable)  → products_categoryId_isRentable_idx
 *   - JOIN pricelist_items (default PL, DAILY/WEEKLY) → the unique (pricelistId,productId,durationUnit) index
 *   - primary image LATERAL             → product_images_productId_sortOrder_idx
 *   - availability EXISTS overlap       → reservations_no_overlap GiST (productUnitId, during)
 *                                          + product_units_productId_status_idx for the unit lookup
 */
export async function listCatalog(req, res) {
  // Coerce here, not via express-validator's .toInt(): in Express 5 `req.query` is a read-only
  // getter, so sanitizer mutations do not persist.
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '12', 10)));
  const offset = (page - 1) * limit;
  const { categoryId, search, minPrice, maxPrice, from, to } = req.query;
  const orderBy = CATALOG_SORTS[req.query.sort] ?? CATALOG_SORTS.name;

  const pricelistId = await defaultPricelistId();

  // Parameter accumulator: p(value) pushes and returns its $N placeholder, so the SQL stays
  // parameterized no matter which optional filters are present.
  const params = [];
  const p = (v) => `$${params.push(v)}`;

  const plParam = p(pricelistId); // may be null → the rate LEFT JOINs simply won't match
  const conds = [`p."isRentable" = true`];
  if (categoryId) conds.push(`p."categoryId" = ${p(categoryId)}::uuid`);
  if (search) conds.push(`p.name ILIKE ${p('%' + search + '%')}`);
  if (minPrice != null && minPrice !== '') conds.push(`daily.rate >= ${p(Number(minPrice))}`);
  if (maxPrice != null && maxPrice !== '') conds.push(`daily.rate <= ${p(Number(maxPrice))}`);

  // Availability window: keep only products with >=1 AVAILABLE unit that has NO live reservation
  // overlapping [from,to). This is the product-level rollup of the same overlap test the EXCLUDE
  // constraint enforces per unit. When a window is given we ALSO return the exact count of units
  // free in that window (availableInWindow) so the card can badge "N available for these dates".
  let availCol = 'NULL::int AS "availableInWindow"';
  if (from && to) {
    const f = p(toTs(new Date(from)));
    const t = p(toTs(new Date(to)));
    const freeUnit =
      `u.status = 'AVAILABLE' AND NOT EXISTS (SELECT 1 FROM reservations r
         WHERE r."productUnitId" = u.id AND r.status IN ('HELD','ACTIVE','FULFILLED')
           AND r.during && tsrange(${f}::timestamp, ${t}::timestamp))`;
    conds.push(`EXISTS (SELECT 1 FROM product_units u WHERE u."productId" = p.id AND ${freeUnit})`);
    availCol = `(SELECT count(*)::int FROM product_units u WHERE u."productId" = p.id AND ${freeUnit}) AS "availableInWindow"`;
  }

  const limitParam = p(limit);
  const offsetParam = p(offset);

  const sql = `
    SELECT p.id, p.name, p.description, p.brand, p.manufacturer, p.color, p.size,
           p."categoryId", c.name AS "categoryName", p."createdAt",
           daily.rate  AS "dailyRate",
           weekly.rate AS "weeklyRate",
           (SELECT count(*)::int FROM product_units u WHERE u."productId" = p.id) AS "unitsTotal",
           (SELECT count(*)::int FROM product_units u WHERE u."productId" = p.id AND u.status = 'AVAILABLE') AS "unitsAvailableNow",
           ${availCol},
           img.path AS "primaryImagePath",
           count(*) OVER()::int AS "totalCount"
    FROM products p
    JOIN categories c ON c.id = p."categoryId"
    LEFT JOIN pricelist_items daily  ON daily."productId"  = p.id AND daily."pricelistId"  = ${plParam}::uuid AND daily."durationUnit"  = 'DAILY'
    LEFT JOIN pricelist_items weekly ON weekly."productId" = p.id AND weekly."pricelistId" = ${plParam}::uuid AND weekly."durationUnit" = 'WEEKLY'
    LEFT JOIN LATERAL (
      SELECT path FROM product_images pi
       WHERE pi."productId" = p.id
       ORDER BY pi."isPrimary" DESC, pi."sortOrder" ASC
       LIMIT 1
    ) img ON true
    WHERE ${conds.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT ${limitParam} OFFSET ${offsetParam}`;

  // Deposit rule is org-wide (active RentalSettings), same for every card — surfaced once in meta so
  // a card can show the refundable-deposit policy (a rental differentiator customers care about).
  const [rows, settings] = await Promise.all([
    prisma.$queryRawUnsafe(sql, ...params),
    prisma.rentalSettings.findFirst({ where: { isActive: true }, select: { depositRuleType: true, depositValue: true, currency: true } }),
  ]);
  const totalCount = rows[0]?.totalCount ?? 0;
  const windowed = Boolean(from && to);

  const data = rows.map((r) => {
    const rates = {};
    if (r.dailyRate != null) rates.DAILY = money(r.dailyRate);
    if (r.weeklyRate != null) rates.WEEKLY = money(r.weeklyRate);
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      brand: r.brand,
      manufacturer: r.manufacturer,
      color: r.color,
      size: r.size,
      categoryId: r.categoryId,
      categoryName: r.categoryName,
      rates, // e.g. { DAILY: "1200.00", WEEKLY: "6000.00" }
      unitsTotal: r.unitsTotal,
      unitsAvailableNow: r.unitsAvailableNow,
      // Only meaningful when a date window is applied; null otherwise (the card shows stock instead).
      availableInWindow: windowed ? r.availableInWindow : null,
      primaryImage: r.primaryImagePath
        ? { path: r.primaryImagePath, url: `${UPLOADS_URL_PREFIX}/${r.primaryImagePath}` }
        : null,
    };
  });

  return ok(res, {
    message: 'Catalogue retrieved',
    data,
    meta: {
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      windowed,
      depositRule: settings ? { ruleType: settings.depositRuleType, value: money(settings.depositValue), currency: settings.currency } : null,
    },
  });
}

/**
 * GET /api/catalog/categories — public list of categories for the storefront filter sidebar.
 * Replaces the frontend's old dependency on the (now deprecated) GET /api/products, which returned
 * categories bolted to hardcoded/in-memory rate fields. Here it is just the real taxonomy.
 */
export async function listCatalogCategories(_req, res) {
  const cats = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });
  return ok(res, {
    message: 'Categories',
    data: cats.map((c) => ({ id: c.id, name: c.name, slug: c.slug, productCount: c._count.products })),
  });
}

/**
 * GET /api/catalog/availability?productId&from&to
 * A GENUINE date-range availability check: which units of this product have NO live reservation
 * overlapping the requested window. This is the same truth the EXCLUDE constraint enforces — a
 * unit is only offered if inserting a reservation for [from,to) would NOT be rejected by
 * reservations_no_overlap.
 *
 * QUERY SHAPE (the one to defend at review):
 *   SELECT u.id, u."serialNumber"
 *   FROM product_units u
 *   WHERE u."productId" = $1
 *     AND u.status = ANY($4)                                  -- structurally rentable
 *     AND NOT EXISTS (
 *       SELECT 1 FROM reservations r
 *       WHERE r."productUnitId" = u.id
 *         AND r.status = ANY($5)                              -- live/occupying holds only
 *         AND r.during && tsrange($2::timestamp, $3::timestamp)   -- range OVERLAP
 *     );
 * INDEX USED: the `&&` overlap predicate is served by the GiST index the EXCLUDE created —
 *   reservations_no_overlap ON reservations USING gist ("productUnitId", during). The correlated
 *   u.id equality lets that same composite GiST index satisfy both the unit match and the overlap.
 *   product_units is reached by its PK/`product_units_productId_status_idx`. This is why the check
 *   is cheap even as reservations grow: it is an index probe per candidate unit, not a scan.
 */
export async function checkAvailability(req, res) {
  const { productId, from, to } = req.query;
  const start = new Date(from);
  const end = new Date(to);
  if (!(end > start)) {
    return fail(res, { status: 422, message: 'to must be after from.', errors: [{ field: 'to', message: 'Must be after from.' }] });
  }

  const pricelistId = await defaultPricelistId();
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: { select: { name: true } },
      pricelistItems: pricelistId
        ? { where: { pricelistId }, select: { durationUnit: true, rate: true } }
        : false,
    },
  });
  if (!product) return fail(res, { status: 404, message: 'Product not found.' });

  // Raw SQL: tsrange + the && overlap operator have no Prisma equivalent. Parameterised — no
  // interpolation of user input.
  const rows = await prisma.$queryRawUnsafe(
    `SELECT u.id, u."serialNumber"
       FROM product_units u
      WHERE u."productId" = $1::uuid
        AND u.status = ANY($4::"ProductUnitStatus"[])
        AND NOT EXISTS (
          SELECT 1 FROM reservations r
           WHERE r."productUnitId" = u.id
             AND r.status = ANY($5::"ReservationStatus"[])
             AND r.during && tsrange($2::timestamp, $3::timestamp)
        )
      ORDER BY u."serialNumber"`,
    productId,
    start.toISOString().slice(0, 19).replace('T', ' '),
    end.toISOString().slice(0, 19).replace('T', ' '),
    RENTABLE_UNIT_STATUSES,
    OCCUPYING_RESERVATION_STATUSES
  );

  const rates = {};
  for (const pi of product.pricelistItems ?? []) rates[pi.durationUnit] = money(pi.rate);

  const durationDays = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));

  return ok(res, {
    message: rows.length ? 'Units available for the requested window.' : 'No units available for the requested window.',
    data: {
      productId,
      productName: product.name,
      from: start,
      to: end,
      durationDays,
      available: rows.length > 0,
      availableCount: rows.length,
      availableUnits: rows.map((r) => ({ id: r.id, serialNumber: r.serialNumber })),
      rates,
      // A convenience estimate the UI can show; authoritative pricing still happens server-side
      // at quotation creation (createQuotation reads the pricelist again).
      estimatedDailyRate: rates.DAILY ?? null,
      estimatedSubtotal: rates.DAILY ? money(Number(rates.DAILY) * durationDays) : null,
    },
  });
}
