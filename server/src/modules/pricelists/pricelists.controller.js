import { prisma } from '../../config/prisma.js';
import { ok, fail } from '../../lib/apiResponse.js';
import { logActivity } from '../../lib/activityLog.js';

export async function listPricelists(req, res) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));

  const [pricelists, totalCount] = await Promise.all([
    prisma.pricelist.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { items: true } } },
    }),
    prisma.pricelist.count(),
  ]);

  return ok(res, {
    data: pricelists.map((pl) => ({
      id: pl.id,
      name: pl.name,
      currency: pl.currency,
      isDefault: pl.isDefault,
      isActive: pl.isActive,
      validFrom: pl.validFrom,
      validTo: pl.validTo,
      itemCount: pl._count.items,
      createdAt: pl.createdAt,
    })),
    meta: {
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
    },
  });
}

export async function getPricelist(req, res) {
  const { id } = req.params;

  const pricelist = await prisma.pricelist.findUnique({
    where: { id },
    include: {
      items: {
        include: { product: { select: { id: true, name: true, sku: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!pricelist) {
    return fail(res, { status: 404, message: 'Pricelist not found.' });
  }

  return ok(res, {
    data: {
      id: pricelist.id,
      name: pricelist.name,
      currency: pricelist.currency,
      isDefault: pricelist.isDefault,
      isActive: pricelist.isActive,
      validFrom: pricelist.validFrom,
      validTo: pricelist.validTo,
      items: pricelist.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        productSku: item.product.sku,
        durationUnit: item.durationUnit,
        rate: item.rate.toString(),
      })),
    },
  });
}

export async function createPricelist(req, res) {
  const { name, validFrom, validTo, isDefault } = req.body;

  const pricelist = await prisma.pricelist.create({
    data: {
      name,
      validFrom: validFrom ? new Date(validFrom) : null,
      validTo: validTo ? new Date(validTo) : null,
      isDefault: isDefault || false,
      isActive: true,
    },
  });

  logActivity({
    userId: req.user.id,
    action: 'pricelist.create',
    entityType: 'Pricelist',
    entityId: pricelist.id,
    metadata: { name },
  });

  return ok(res, { status: 201, data: { id: pricelist.id, name: pricelist.name, createdAt: pricelist.createdAt } });
}

export async function updatePricelist(req, res) {
  const { id } = req.params;
  const { name, validFrom, validTo, isDefault } = req.body;

  const existing = await prisma.pricelist.findUnique({ where: { id } });
  if (!existing) {
    return fail(res, { status: 404, message: 'Pricelist not found.' });
  }

  const updated = await prisma.pricelist.update({
    where: { id },
    data: {
      name,
      validFrom: validFrom ? new Date(validFrom) : null,
      validTo: validTo ? new Date(validTo) : null,
      isDefault: isDefault ?? existing.isDefault,
    },
  });

  return ok(res, { data: { id: updated.id, name: updated.name } });
}

export async function deletePricelist(req, res) {
  const { id } = req.params;

  try {
    await prisma.pricelist.delete({ where: { id } });
  } catch (err) {
    if (err.code === 'P2025') {
      return fail(res, { status: 404, message: 'Pricelist not found.' });
    }
    if (err.code === 'P2003') {
      return fail(res, { status: 409, message: 'Cannot delete pricelist that is referenced by orders.' });
    }
    throw err;
  }

  return ok(res, { message: 'Pricelist deleted.' });
}

export async function addPricelistItem(req, res) {
  const { id } = req.params;
  const { productId, durationUnit, rate } = req.body;

  const pricelist = await prisma.pricelist.findUnique({ where: { id } });
  if (!pricelist) {
    return fail(res, { status: 404, message: 'Pricelist not found.' });
  }

  // Check for duplicate
  const existing = await prisma.pricelistItem.findFirst({
    where: { pricelistId: id, productId, durationUnit },
  });
  if (existing) {
    // Update instead
    const updated = await prisma.pricelistItem.update({
      where: { id: existing.id },
      data: { rate: parseFloat(rate) },
    });
    return ok(res, { data: { id: updated.id, rate: updated.rate.toString() } });
  }

  const item = await prisma.pricelistItem.create({
    data: {
      pricelistId: id,
      productId,
      durationUnit,
      rate: parseFloat(rate),
    },
  });

  return ok(res, { status: 201, data: { id: item.id, productId, durationUnit, rate: item.rate.toString() } });
}

export async function removePricelistItem(req, res) {
  const { itemId } = req.params;

  try {
    await prisma.pricelistItem.delete({ where: { id: itemId } });
  } catch (err) {
    if (err.code === 'P2025') {
      return fail(res, { status: 404, message: 'Item not found.' });
    }
    throw err;
  }

  return ok(res, { message: 'Rate removed.' });
}
