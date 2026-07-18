/**
 * Admin CRUD for the catalogue's configuration tables: Category (the browse taxonomy) and
 * PricelistItem (the real rates that price a rental). These replace the legacy /api/products
 * category endpoints whose "rates" were hardcoded literals and whose settings lived in an in-memory
 * Map that vanished on restart — here every value is a real, persisted row.
 *
 * Delete honours the schema's Restrict FKs by pre-checking and returning a 409 that names the
 * blocker (a category with products, a rate in use is just deleted — rates carry no dependents).
 */
import { prisma } from '../../config/prisma.js';
import { ok, fail } from '../../lib/apiResponse.js';
import { logActivity } from '../../lib/activityLog.js';

const money = (d) => (d == null ? null : Number(d).toFixed(2));

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

// ========================= CATEGORIES =======================================

export async function listCategories(_req, res) {
  const cats = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true, children: true } } },
  });
  return ok(res, {
    message: 'Categories',
    data: cats.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parentId,
      productCount: c._count.products,
      childCount: c._count.children,
      createdAt: c.createdAt,
    })),
  });
}

export async function createCategory(req, res) {
  const { name, parentId } = req.body;
  const category = await prisma.category.create({
    data: { name, slug: slugify(name), parentId: parentId ?? null }, // unique slug → 409
  });
  logActivity({ userId: req.user.id, action: 'category.create', entityType: 'Category', entityId: category.id, metadata: { name } });
  return ok(res, { status: 201, message: 'Category created', data: { id: category.id, name: category.name, slug: category.slug, parentId: category.parentId } });
}

export async function updateCategory(req, res) {
  const { id } = req.params;
  const { name, parentId } = req.body;
  const data = {};
  if (name !== undefined) {
    data.name = name;
    data.slug = slugify(name);
  }
  if (parentId !== undefined) data.parentId = parentId || null;

  const category = await prisma.category.update({ where: { id }, data }); // P2025 → 404, unique slug → 409
  logActivity({ userId: req.user.id, action: 'category.update', entityType: 'Category', entityId: id });
  return ok(res, { message: 'Category updated', data: { id: category.id, name: category.name, slug: category.slug, parentId: category.parentId } });
}

export async function deleteCategory(req, res) {
  const { id } = req.params;
  const category = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
  if (!category) return fail(res, { status: 404, message: 'Category not found.' });
  if (category._count.products > 0) {
    return fail(res, { status: 409, message: `Cannot delete: ${category._count.products} product(s) are in this category. Reassign or delete them first.` });
  }
  await prisma.category.delete({ where: { id } }); // children SetNull to top-level (schema)
  logActivity({ userId: req.user.id, action: 'category.delete', entityType: 'Category', entityId: id });
  return ok(res, { message: 'Category deleted', data: { id } });
}

// ========================= PRICELISTS / ITEMS ===============================

export async function listPricelists(_req, res) {
  const lists = await prisma.pricelist.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }], include: { _count: { select: { items: true } } } });
  return ok(res, {
    message: 'Pricelists',
    data: lists.map((l) => ({ id: l.id, name: l.name, currency: l.currency, isDefault: l.isDefault, isActive: l.isActive, itemCount: l._count.items })),
  });
}

export async function listPricelistItems(req, res) {
  const where = {};
  if (req.query.pricelistId) where.pricelistId = req.query.pricelistId;
  if (req.query.productId) where.productId = req.query.productId;
  const items = await prisma.pricelistItem.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: { product: { select: { id: true, name: true } } },
  });
  return ok(res, {
    message: 'Pricelist items',
    data: items.map((i) => ({ id: i.id, pricelistId: i.pricelistId, productId: i.productId, productName: i.product?.name ?? null, durationUnit: i.durationUnit, rate: money(i.rate) })),
  });
}

export async function createPricelistItem(req, res) {
  const { pricelistId, productId, durationUnit, rate } = req.body;
  const item = await prisma.pricelistItem.create({
    data: { pricelistId, productId, durationUnit, rate: Number(rate) }, // unique triple → 409; bad FK → 422
  });
  logActivity({ userId: req.user.id, action: 'pricelist_item.create', entityType: 'PricelistItem', entityId: item.id, metadata: { productId, durationUnit } });
  return ok(res, { status: 201, message: 'Rate created', data: { id: item.id, pricelistId: item.pricelistId, productId: item.productId, durationUnit: item.durationUnit, rate: money(item.rate) } });
}

export async function updatePricelistItem(req, res) {
  const { id } = req.params;
  const item = await prisma.pricelistItem.update({ where: { id }, data: { rate: Number(req.body.rate) } }); // P2025 → 404
  logActivity({ userId: req.user.id, action: 'pricelist_item.update', entityType: 'PricelistItem', entityId: id });
  return ok(res, { message: 'Rate updated', data: { id: item.id, durationUnit: item.durationUnit, rate: money(item.rate) } });
}

export async function deletePricelistItem(req, res) {
  const { id } = req.params;
  await prisma.pricelistItem.delete({ where: { id } }); // P2025 → 404
  logActivity({ userId: req.user.id, action: 'pricelist_item.delete', entityType: 'PricelistItem', entityId: id });
  return ok(res, { message: 'Rate deleted', data: { id } });
}
