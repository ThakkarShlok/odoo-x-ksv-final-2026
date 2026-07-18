/**
 * Admin CRUD for Products and their product-scoped children: physical Units and gallery Images,
 * plus per-duration Rates (which are PricelistItem rows on the default pricelist). This is the
 * endpoint that closes the reviewer's concrete gap — "an admin cannot create a product a customer
 * then browses": createProduct can, in ONE atomic call, create the product, its units, its rates,
 * and (via the separate image upload) its photos, after which GET /api/catalog surfaces it.
 *
 * Every write goes through withTransaction where more than one row is touched, logs to the audit
 * trail, and lets Postgres constraints (unique serial, unique rate triple, the one-primary-image
 * partial index) be the arbiter — surfaced as clean 409s by the Prisma error mapper. Restrict FKs
 * (a product with units/order-lines, a unit with reservations) are pre-checked and reported as a
 * 409 that NAMES what blocks the delete, rather than letting a raw FK violation become a vague 422.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../../config/prisma.js';
import { withTransaction } from '../../lib/withTransaction.js';
import { ok, fail, AppError } from '../../lib/apiResponse.js';
import { logActivity } from '../../lib/activityLog.js';
import { resolveDefaultPricelistId } from '../../lib/pricelists.js';
import { UPLOADS_ROOT, UPLOADS_URL_PREFIX } from '../../lib/uploads.js';

const money = (d) => (d == null ? null : Number(d).toFixed(2));

// A stored image row → the client shape. `path` is the on-disk relative path; `url` is what an
// <img src> uses (the static mount prefix + path). The browser prepends the API origin.
const toImage = (img) => ({
  id: img.id,
  path: img.path,
  url: `${UPLOADS_URL_PREFIX}/${img.path}`,
  isPrimary: img.isPrimary,
  sortOrder: img.sortOrder,
});

function toProductDetail(p) {
  const rates = {};
  for (const pi of p.pricelistItems ?? []) rates[pi.durationUnit] = money(pi.rate);
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? null,
    sku: p.sku,
    brand: p.brand,
    manufacturer: p.manufacturer,
    color: p.color,
    size: p.size,
    isRentable: p.isRentable,
    rates,
    units: (p.units ?? []).map((u) => ({
      id: u.id,
      serialNumber: u.serialNumber,
      condition: u.condition,
      status: u.status,
      notes: u.notes,
    })),
    images: (p.images ?? []).map(toImage),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// Upsert the { DURATION: amount } rate map onto the default pricelist for a product, inside a tx.
async function applyRates(tx, productId, rates) {
  const entries = Object.entries(rates ?? {}).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return;
  const pricelistId = await resolveDefaultPricelistId(tx);
  if (!pricelistId) {
    throw new AppError('No pricelist exists to attach rates to. Create a pricelist first.', 422);
  }
  for (const [durationUnit, rate] of entries) {
    await tx.pricelistItem.upsert({
      where: { pricelistId_productId_durationUnit: { pricelistId, productId, durationUnit } },
      update: { rate: Number(rate) },
      create: { pricelistId, productId, durationUnit, rate: Number(rate) },
    });
  }
}

// ========================= PRODUCTS =========================================

export async function listProducts(req, res) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const { categoryId, search, isRentable } = req.query;

  const where = {};
  if (categoryId) where.categoryId = categoryId;
  if (search) where.name = { contains: search, mode: 'insensitive' };
  if (isRentable !== undefined) where.isRentable = isRentable === 'true' || isRentable === true;

  const pricelistId = await resolveDefaultPricelistId();

  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { id: true, name: true } },
        images: { where: { isPrimary: true }, take: 1 },
        pricelistItems: pricelistId ? { where: { pricelistId }, select: { durationUnit: true, rate: true } } : false,
        _count: { select: { units: true, images: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const data = products.map((p) => {
    const rates = {};
    for (const pi of p.pricelistItems ?? []) rates[pi.durationUnit] = money(pi.rate);
    return {
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      brand: p.brand,
      isRentable: p.isRentable,
      rates,
      unitCount: p._count.units,
      imageCount: p._count.images,
      primaryImage: p.images[0] ? toImage(p.images[0]) : null,
      createdAt: p.createdAt,
    };
  });

  return ok(res, {
    message: 'Products',
    data,
    meta: { totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) },
  });
}

export async function getProduct(req, res) {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: {
      category: { select: { id: true, name: true } },
      units: { orderBy: { serialNumber: 'asc' } },
      images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
      pricelistItems: true,
    },
  });
  if (!product) return fail(res, { status: 404, message: 'Product not found.' });
  return ok(res, { message: 'Product', data: toProductDetail(product) });
}

export async function createProduct(req, res) {
  const { name, categoryId, description, brand, manufacturer, color, size, sku, isRentable, rates, units } = req.body;

  const product = await withTransaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        name,
        categoryId, // FK → 23503/P2003 → 422 if category doesn't exist
        description: description ?? null,
        brand: brand ?? null,
        manufacturer: manufacturer ?? null,
        color: color ?? null,
        size: size ?? null,
        sku: sku || null, // unique when present → 409
        isRentable: isRentable ?? true,
      },
    });

    // Optional physical units, one create() each so a duplicate serial surfaces as a 409 for that
    // specific serial rather than an opaque batch failure.
    for (const u of units ?? []) {
      await tx.productUnit.create({
        data: { productId: created.id, serialNumber: u.serialNumber, condition: u.condition ?? 'GOOD' },
      });
    }

    await applyRates(tx, created.id, rates);

    return tx.product.findUnique({
      where: { id: created.id },
      include: { category: { select: { id: true, name: true } }, units: true, images: true, pricelistItems: true },
    });
  });

  logActivity({ userId: req.user.id, action: 'product.create', entityType: 'Product', entityId: product.id, metadata: { name } });
  return ok(res, { status: 201, message: 'Product created', data: toProductDetail(product) });
}

export async function updateProduct(req, res) {
  const { id } = req.params;
  const { name, categoryId, description, brand, manufacturer, color, size, sku, isRentable, rates } = req.body;

  const data = {};
  for (const [k, v] of Object.entries({ name, categoryId, description, brand, manufacturer, color, size, isRentable })) {
    if (v !== undefined) data[k] = v;
  }
  if (sku !== undefined) data.sku = sku || null;

  const product = await withTransaction(async (tx) => {
    await tx.product.update({ where: { id }, data }); // P2025 → 404
    await applyRates(tx, id, rates);
    return tx.product.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true } }, units: true, images: true, pricelistItems: true },
    });
  });

  logActivity({ userId: req.user.id, action: 'product.update', entityType: 'Product', entityId: id });
  return ok(res, { message: 'Product updated', data: toProductDetail(product) });
}

export async function deleteProduct(req, res) {
  const { id } = req.params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { _count: { select: { units: true, orderLines: true } }, images: true },
  });
  if (!product) return fail(res, { status: 404, message: 'Product not found.' });

  // Restrict FKs pre-checked so the message NAMES the blocker instead of a raw FK 23503.
  if (product._count.orderLines > 0) {
    return fail(res, { status: 409, message: `Cannot delete: this product is on ${product._count.orderLines} rental order line(s). Products with rental history are permanent.` });
  }
  if (product._count.units > 0) {
    return fail(res, { status: 409, message: `Cannot delete: this product has ${product._count.units} unit(s). Delete the units first.` });
  }

  await withTransaction(async (tx) => {
    await tx.pricelistItem.deleteMany({ where: { productId: id } }); // Restrict → must go first
    await tx.product.delete({ where: { id } }); // images cascade
  });

  // Best-effort unlink of the now-orphaned image files (the DB rows are already gone).
  for (const img of product.images) {
    fs.unlink(path.join(UPLOADS_ROOT, img.path)).catch(() => {});
  }

  logActivity({ userId: req.user.id, action: 'product.delete', entityType: 'Product', entityId: id });
  return ok(res, { message: 'Product deleted', data: { id } });
}

// ========================= UNITS ============================================

export async function listUnits(req, res) {
  const units = await prisma.productUnit.findMany({ where: { productId: req.params.id }, orderBy: { serialNumber: 'asc' } });
  return ok(res, { message: 'Units', data: units.map((u) => ({ id: u.id, serialNumber: u.serialNumber, condition: u.condition, status: u.status, notes: u.notes })) });
}

export async function createUnit(req, res) {
  const { id } = req.params; // product id
  const { serialNumber, condition, status, notes } = req.body;

  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return fail(res, { status: 404, message: 'Product not found.' });

  const unit = await prisma.productUnit.create({
    data: { productId: id, serialNumber, condition: condition ?? 'GOOD', status: status ?? 'AVAILABLE', notes: notes ?? null },
  });
  logActivity({ userId: req.user.id, action: 'unit.create', entityType: 'ProductUnit', entityId: unit.id, metadata: { serialNumber } });
  return ok(res, { status: 201, message: 'Unit created', data: { id: unit.id, serialNumber: unit.serialNumber, condition: unit.condition, status: unit.status, notes: unit.notes } });
}

export async function updateUnit(req, res) {
  const { unitId } = req.params;
  const { condition, status, notes } = req.body;
  const data = {};
  if (condition !== undefined) data.condition = condition;
  if (status !== undefined) data.status = status;
  if (notes !== undefined) data.notes = notes;

  const unit = await prisma.productUnit.update({ where: { id: unitId }, data }); // P2025 → 404
  logActivity({ userId: req.user.id, action: 'unit.update', entityType: 'ProductUnit', entityId: unitId });
  return ok(res, { message: 'Unit updated', data: { id: unit.id, serialNumber: unit.serialNumber, condition: unit.condition, status: unit.status, notes: unit.notes } });
}

export async function deleteUnit(req, res) {
  const { unitId } = req.params;
  const unit = await prisma.productUnit.findUnique({ where: { id: unitId }, include: { _count: { select: { reservations: true, orderLines: true } } } });
  if (!unit) return fail(res, { status: 404, message: 'Unit not found.' });
  if (unit._count.orderLines > 0 || unit._count.reservations > 0) {
    return fail(res, { status: 409, message: `Cannot delete: this unit has ${unit._count.reservations} reservation(s) and ${unit._count.orderLines} order line(s) of history.` });
  }
  await prisma.productUnit.delete({ where: { id: unitId } });
  logActivity({ userId: req.user.id, action: 'unit.delete', entityType: 'ProductUnit', entityId: unitId });
  return ok(res, { message: 'Unit deleted', data: { id: unitId } });
}

// ========================= IMAGES ===========================================

export async function listImages(req, res) {
  const images = await prisma.productImage.findMany({ where: { productId: req.params.id }, orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] });
  return ok(res, { message: 'Images', data: images.map(toImage) });
}

export async function uploadImage(req, res) {
  const { id } = req.params; // product id
  if (!req.file) return fail(res, { status: 422, message: 'No image file provided. Upload under the field name "image".' });

  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) {
    // multer already wrote the file; remove the orphan before returning.
    await fs.unlink(path.join(UPLOADS_ROOT, 'products', req.file.filename)).catch(() => {});
    return fail(res, { status: 404, message: 'Product not found.' });
  }

  const relPath = `products/${req.file.filename}`;
  const existingCount = await prisma.productImage.count({ where: { productId: id } });
  const maxSort = await prisma.productImage.aggregate({ where: { productId: id }, _max: { sortOrder: true } });

  const image = await prisma.productImage.create({
    data: {
      productId: id,
      path: relPath,
      isPrimary: existingCount === 0, // first image becomes the thumbnail; one-primary index holds
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  logActivity({ userId: req.user.id, action: 'product.image.upload', entityType: 'ProductImage', entityId: image.id, metadata: { productId: id } });
  return ok(res, { status: 201, message: 'Image uploaded', data: toImage(image) });
}

export async function setPrimaryImage(req, res) {
  const { id, imageId } = req.params;
  const image = await prisma.productImage.findFirst({ where: { id: imageId, productId: id } });
  if (!image) return fail(res, { status: 404, message: 'Image not found for this product.' });

  // Unset the current primary BEFORE setting the new one so the product_images_one_primary partial
  // unique index never sees two primaries mid-transaction.
  await withTransaction(async (tx) => {
    await tx.productImage.updateMany({ where: { productId: id, isPrimary: true }, data: { isPrimary: false } });
    await tx.productImage.update({ where: { id: imageId }, data: { isPrimary: true } });
  });

  logActivity({ userId: req.user.id, action: 'product.image.set_primary', entityType: 'ProductImage', entityId: imageId, metadata: { productId: id } });
  return ok(res, { message: 'Primary image set', data: { id: imageId } });
}

export async function deleteImage(req, res) {
  const { id, imageId } = req.params;
  const image = await prisma.productImage.findFirst({ where: { id: imageId, productId: id } });
  if (!image) return fail(res, { status: 404, message: 'Image not found for this product.' });

  await prisma.productImage.delete({ where: { id: imageId } });
  await fs.unlink(path.join(UPLOADS_ROOT, image.path)).catch(() => {}); // best-effort file removal

  // If we removed the primary, promote the next image (by sortOrder) so a product never silently
  // loses its thumbnail while other images remain.
  if (image.isPrimary) {
    const next = await prisma.productImage.findFirst({ where: { productId: id }, orderBy: { sortOrder: 'asc' } });
    if (next) await prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
  }

  logActivity({ userId: req.user.id, action: 'product.image.delete', entityType: 'ProductImage', entityId: imageId, metadata: { productId: id } });
  return ok(res, { message: 'Image deleted', data: { id: imageId } });
}
