/**
 * ============================================================================
 * DEPRECATED MODULE — /api/products  (kept mounted, do not extend)
 * ============================================================================
 * WHAT REPLACED IT AND WHY IT IS STILL HERE:
 *   This module predates the real catalogue work. Its GET returned Categories bolted to HARDCODED
 *   rate fields (baseHourlyRate:"10.00", baseDailyRate:"50.00") and its category/template "config"
 *   lived in IN-MEMORY Maps that silently reset on every server restart — data that looked
 *   persistent but was not. Phase 1 replaced it with real, DB-backed surfaces:
 *     • admin catalogue management  → /api/admin/*  (Category/Product/Unit/PricelistItem CRUD)
 *     • public storefront reads      → /api/catalog   (real PricelistItem rates + categories)
 *   It stays mounted, and its in-memory Maps are removed, so that anything still pointing at these
 *   URLs keeps getting a valid (if legacy-shaped) response instead of a 404 — deprecate-in-place,
 *   not delete-and-break. Every response carries a `Deprecation` header (see products.routes.js).
 *   New work must target /api/admin and /api/catalog. This file is intentionally frozen.
 * ============================================================================
 */
import { prisma } from '../../config/prisma.js';
import { ok, fail } from '../../lib/apiResponse.js';
import { logActivity } from '../../lib/activityLog.js';

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * GET /api/products — DEPRECATED. Lists Categories from the DB (no more in-memory Map, no more
 * fake rate literals). Prefer GET /api/catalog/categories for the storefront and
 * GET /api/admin/categories for management.
 */
export async function listCategories(req, res) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));
  const search = req.query.search;

  const where = {};
  if (search) where.name = { contains: search, mode: 'insensitive' };

  const [categories, totalCount] = await Promise.all([
    prisma.category.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    }),
    prisma.category.count({ where }),
  ]);

  return ok(res, {
    data: categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId,
      productCount: cat._count.products,
    })),
    meta: { totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) },
  });
}

/**
 * POST /api/products — DEPRECATED. Creates a Category row (real), minus the old in-memory pricing
 * fields. Use POST /api/admin/categories for new work.
 */
export async function createCategory(req, res) {
  const { name } = req.body;

  const existing = await prisma.category.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
  if (existing) return fail(res, { status: 409, message: 'Category name already exists.' });

  const category = await prisma.category.create({ data: { name, slug: slugify(name) } });

  logActivity({ userId: req.user.id, action: 'category.create', entityType: 'Category', entityId: category.id, metadata: { name, via: 'deprecated /api/products' } });

  return ok(res, { status: 201, data: { id: category.id, name: category.name, slug: category.slug, createdAt: category.createdAt } });
}

/**
 * POST /api/products/pricelists — creates a Pricelist and its DAILY/HOURLY items from category
 * rules. This one already wrote REAL rows (never a Map), so it is preserved unchanged for anything
 * relying on it; new work should use POST /api/admin/pricelist-items.
 */
export async function createPricelist(req, res) {
  const { name, description, startDate, endDate, rules } = req.body;

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end <= start) return fail(res, { status: 400, message: 'endDate must occur after startDate.' });

  const pricelist = await prisma.$transaction(async (tx) => {
    const pl = await tx.pricelist.create({
      data: { name, currency: 'INR', isDefault: false, isActive: true, validFrom: start, validTo: end },
    });

    for (const rule of rules ?? []) {
      const products = await tx.product.findMany({ where: { categoryId: rule.categoryId } });
      for (const prod of products) {
        await tx.pricelistItem.create({ data: { pricelistId: pl.id, productId: prod.id, durationUnit: 'DAILY', rate: rule.overrideDailyRate } });
        await tx.pricelistItem.create({ data: { pricelistId: pl.id, productId: prod.id, durationUnit: 'HOURLY', rate: rule.overrideHourlyRate } });
      }
    }
    return pl;
  });

  logActivity({ userId: req.user.id, action: 'pricelist.create', entityType: 'Pricelist', entityId: pricelist.id, metadata: { name } });

  return ok(res, {
    status: 201,
    data: { id: pricelist.id, name: pricelist.name, description, startDate: pricelist.validFrom, endDate: pricelist.validTo, isActive: pricelist.isActive, createdAt: pricelist.createdAt },
  });
}

/**
 * POST /api/products/quotation-templates — REMOVED. This was a phantom feature backed only by an
 * in-memory Map with no schema behind it (a template store that vanished on restart). Rather than
 * pretend to persist, it now returns 501 so the absence is honest. There is no replacement in
 * Phase 1 scope; a real implementation would need a QuotationTemplate table.
 */
export async function createQuotationTemplate(_req, res) {
  return fail(res, {
    status: 501,
    message: 'Quotation templates are not implemented. The previous in-memory store was removed; a persistent QuotationTemplate table would be required.',
  });
}
