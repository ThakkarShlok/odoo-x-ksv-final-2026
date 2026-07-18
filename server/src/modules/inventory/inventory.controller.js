import { prisma } from '../../config/prisma.js';
import { ok, fail } from '../../lib/apiResponse.js';
import { logActivity } from '../../lib/activityLog.js';

// In-memory telemetry log storage
// assetUnitId -> array of { lat, lng, velocity, battery, timestamp }
export const telemetryLogs = new Map();

function toPublicAsset(unit) {
  return {
    id: unit.id,
    barcode: unit.serialNumber,
    brand: unit.product?.brand || '',
    manufacturer: unit.product?.manufacturer || '',
    color: unit.product?.color || '',
    size: unit.product?.size || '',
    status: unit.status,
    categoryId: unit.product?.categoryId || '',
    categoryName: unit.product?.category?.name || '',
    totalHoursRun: '0.00', // Placeholder
  };
}

export async function listAssets(req, res) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));
  const status = req.query.status;
  const brand = req.query.brand;
  const categoryId = req.query.categoryId;

  const where = {};
  if (status) {
    where.status = status;
  }
  if (brand || categoryId) {
    where.product = {};
    if (brand) {
      where.product.brand = { contains: brand, mode: 'insensitive' };
    }
    if (categoryId) {
      where.product.categoryId = categoryId;
    }
  }

  const [units, totalCount] = await Promise.all([
    prisma.productUnit.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          include: { category: true },
        },
      },
    }),
    prisma.productUnit.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return ok(res, {
    data: units.map(toPublicAsset),
    meta: {
      totalCount,
      page,
      limit,
      totalPages,
    },
  });
}

export async function addAsset(req, res) {
  const { barcode, brand, manufacturer, color, size, categoryId } = req.body;

  // Check if barcode already exists
  const existingUnit = await prisma.productUnit.findUnique({
    where: { serialNumber: barcode },
  });
  if (existingUnit) {
    return fail(res, { status: 409, message: 'Barcode value already matches another active asset.' });
  }

  const result = await prisma.$transaction(async (tx) => {
    // Check if matching Product type already exists
    let product = await tx.product.findFirst({
      where: {
        categoryId,
        brand,
        manufacturer,
        color,
        size,
      },
    });

    if (!product) {
      // Create new Product definition
      product = await tx.product.create({
        data: {
          categoryId,
          name: `${brand} ${size || ''} ${color || ''}`.trim(),
          brand,
          manufacturer,
          color,
          size,
          sku: `SKU-${barcode.toUpperCase()}`,
        },
      });
    }

    // Create physical unit copy linked to product
    const unit = await tx.productUnit.create({
      data: {
        productId: product.id,
        serialNumber: barcode,
        status: 'AVAILABLE',
      },
      include: {
        product: {
          include: { category: true },
        },
      },
    });

    return unit;
  });

  logActivity({
    userId: req.user.id,
    action: 'asset.create',
    entityType: 'ProductUnit',
    entityId: result.id,
    metadata: { barcode: result.serialNumber },
  });

  return ok(res, {
    status: 201,
    data: {
      id: result.id,
      barcode: result.serialNumber,
      status: result.status,
      categoryId: result.product.categoryId,
      totalHoursRun: '0.00',
      createdAt: result.createdAt,
    },
  });
}

export async function getAssetByBarcode(req, res) {
  const { barcode } = req.params;

  const unit = await prisma.productUnit.findUnique({
    where: { serialNumber: barcode },
    include: {
      product: {
        include: { category: true },
      },
    },
  });

  if (!unit) {
    return fail(res, { status: 404, message: 'Asset barcode not active.' });
  }

  return ok(res, {
    data: {
      id: unit.id,
      barcode: unit.serialNumber,
      brand: unit.product?.brand || '',
      status: unit.status,
      categoryName: unit.product?.category?.name || '',
    },
  });
}

export async function ingestTelemetry(req, res) {
  const { id } = req.params;
  const { lat, lng, velocity, battery } = req.body;

  const unit = await prisma.productUnit.findUnique({ where: { id } });
  if (!unit) {
    return fail(res, { status: 404, message: 'Asset not found.' });
  }

  const logs = telemetryLogs.get(id) || [];
  const logEntry = {
    lat: lat.toString(),
    lng: lng.toString(),
    velocity: velocity.toString(),
    battery: battery.toString(),
    timestamp: new Date().toISOString(),
  };

  logs.unshift(logEntry);
  if (logs.length > 100) logs.pop(); // Keep last 100 entries

  telemetryLogs.set(id, logs);

  return ok(res, { message: 'Telemetry logged successfully.' });
}

export async function getTelemetry(req, res) {
  const { id } = req.params;
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));

  const unit = await prisma.productUnit.findUnique({ where: { id } });
  if (!unit) {
    return fail(res, { status: 404, message: 'Asset not found.' });
  }

  const logs = telemetryLogs.get(id) || [];
  return ok(res, { data: logs.slice(0, limit) });
}
