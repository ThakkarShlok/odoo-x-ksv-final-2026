import { prisma } from '../../config/prisma.js';
import { ok, fail } from '../../lib/apiResponse.js';
import { logActivity } from '../../lib/activityLog.js';

// In-memory extensions for Category pricing fields and Quotation Templates
export const categorySettings = new Map();
export const quotationTemplates = new Map();

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

export async function listCategories(req, res) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));
  const search = req.query.search;

  const where = {};
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  const [categories, totalCount] = await Promise.all([
    prisma.category.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.category.count({ where }),
  ]);

  const defaultSettings = await prisma.rentalSettings.findFirst({
    where: { isActive: true },
  });

  const responseData = categories.map((cat) => {
    const custom = categorySettings.get(cat.id);
    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      depositMethod: custom?.depositMethod || defaultSettings?.depositRuleType || 'PERCENTAGE',
      depositValue: custom?.depositValue || defaultSettings?.depositValue?.toString() || '20.00',
      baseHourlyRate: custom?.baseHourlyRate || '10.00',
      baseDailyRate: custom?.baseDailyRate || '50.00',
    };
  });

  const totalPages = Math.ceil(totalCount / limit);

  return ok(res, {
    data: responseData,
    meta: {
      totalCount,
      page,
      limit,
      totalPages,
    },
  });
}

export async function createCategory(req, res) {
  const { name, depositMethod, depositValue, baseHourlyRate, baseDailyRate } = req.body;

  const existing = await prisma.category.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  });
  if (existing) {
    return fail(res, { status: 409, message: 'Category name already exists.' });
  }

  const slug = slugify(name);
  const category = await prisma.category.create({
    data: { name, slug },
  });

  categorySettings.set(category.id, {
    depositMethod,
    depositValue: depositValue.toString(),
    baseHourlyRate: baseHourlyRate.toString(),
    baseDailyRate: baseDailyRate.toString(),
  });

  logActivity({
    userId: req.user.id,
    action: 'category.create',
    entityType: 'Category',
    entityId: category.id,
    metadata: { name },
  });

  return ok(res, {
    status: 201,
    data: {
      id: category.id,
      name: category.name,
      depositMethod,
      depositValue: depositValue.toString(),
      baseHourlyRate: baseHourlyRate.toString(),
      baseDailyRate: baseDailyRate.toString(),
      createdAt: category.createdAt,
    },
  });
}

export async function createPricelist(req, res) {
  const { name, description, startDate, endDate, rules } = req.body;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end <= start) {
    return fail(res, { status: 400, message: 'endDate must occur after startDate.' });
  }

  // Create Pricelist record in DB
  const pricelist = await prisma.$transaction(async (tx) => {
    const pl = await tx.pricelist.create({
      data: {
        name,
        currency: 'INR',
        isDefault: false,
        isActive: true,
        validFrom: start,
        validTo: end,
      },
    });

    if (rules && rules.length > 0) {
      for (const rule of rules) {
        // Find all products in the category
        const products = await tx.product.findMany({
          where: { categoryId: rule.categoryId },
        });

        for (const prod of products) {
          // Create Daily override
          await tx.pricelistItem.create({
            data: {
              pricelistId: pl.id,
              productId: prod.id,
              durationUnit: 'DAILY',
              rate: rule.overrideDailyRate,
            },
          });
          // Create Hourly override
          await tx.pricelistItem.create({
            data: {
              pricelistId: pl.id,
              productId: prod.id,
              durationUnit: 'HOURLY',
              rate: rule.overrideHourlyRate,
            },
          });
        }
      }
    }

    return pl;
  });

  logActivity({
    userId: req.user.id,
    action: 'pricelist.create',
    entityType: 'Pricelist',
    entityId: pricelist.id,
    metadata: { name },
  });

  return ok(res, {
    status: 201,
    data: {
      id: pricelist.id,
      name: pricelist.name,
      description,
      startDate: pricelist.validFrom,
      endDate: pricelist.validTo,
      isActive: pricelist.isActive,
      createdAt: pricelist.createdAt,
    },
  });
}

export async function createQuotationTemplate(req, res) {
  const { name, headerContent, footerContent } = req.body;

  // Enforce name uniqueness in memory
  for (const template of quotationTemplates.values()) {
    if (template.name.toLowerCase() === name.toLowerCase()) {
      return fail(res, { status: 409, message: 'Template name already exists.' });
    }
  }

  const id = crypto.randomUUID ? crypto.randomUUID() : `temp-${Date.now()}`;
  const now = new Date();
  const template = {
    id,
    name,
    headerContent,
    footerContent,
    isActive: true,
    createdAt: now,
  };

  quotationTemplates.set(id, template);

  logActivity({
    userId: req.user.id,
    action: 'quotation_template.create',
    entityType: 'QuotationTemplate',
    entityId: id,
    metadata: { name },
  });

  return ok(res, {
    status: 201,
    data: template,
  });
}
