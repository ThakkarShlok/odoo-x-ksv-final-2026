/**
 * Validators for the admin catalogue-management surface. Every rule chain whitelists exactly the
 * fields the matching controller reads — the mass-assignment defence the repo relies on (see
 * middleware/validate.js). Money is validated as a non-negative decimal; enums are constrained to
 * the Prisma enum members so an illegal value is rejected at the edge, before Postgres has to.
 */
import { body, param, query } from 'express-validator';

const DURATION_UNITS = ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'];
const UNIT_CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'];
const UNIT_STATUSES = ['AVAILABLE', 'RESERVED', 'RENTED', 'MAINTENANCE', 'DAMAGED', 'RETIRED'];

const uuidParam = (name) => param(name).isUUID().withMessage(`${name} must be a UUID.`);

// ----- Categories -----------------------------------------------------------
export const createCategoryRules = [
  body('name').isString().trim().notEmpty().withMessage('name is required.').isLength({ max: 120 }),
  body('parentId').optional({ nullable: true }).isUUID().withMessage('parentId must be a UUID.'),
];
export const updateCategoryRules = [
  uuidParam('id'),
  body('name').optional().isString().trim().notEmpty().isLength({ max: 120 }),
  body('parentId').optional({ nullable: true }).custom((v) => v === null || /^[0-9a-f-]{36}$/i.test(v)).withMessage('parentId must be a UUID or null.'),
];

// ----- Products -------------------------------------------------------------
const rateFields = [
  body('rates').optional().isObject().withMessage('rates must be an object of { DURATION: amount }.'),
  body('rates.*').optional().isFloat({ min: 0 }).withMessage('each rate must be a non-negative number.'),
];

export const listProductsRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('categoryId').optional().isUUID(),
  query('search').optional().isString().trim(),
  query('isRentable').optional().isBoolean(),
];

export const createProductRules = [
  body('name').isString().trim().notEmpty().withMessage('name is required.').isLength({ max: 200 }),
  body('categoryId').isUUID().withMessage('categoryId is required and must be a UUID.'),
  body('description').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  body('brand').optional({ nullable: true }).isString().isLength({ max: 120 }),
  body('manufacturer').optional({ nullable: true }).isString().isLength({ max: 120 }),
  body('color').optional({ nullable: true }).isString().isLength({ max: 60 }),
  body('size').optional({ nullable: true }).isString().isLength({ max: 60 }),
  body('sku').optional({ nullable: true }).isString().isLength({ max: 60 }),
  body('isRentable').optional().isBoolean(),
  ...rateFields,
  body('units').optional().isArray().withMessage('units must be an array.'),
  body('units.*.serialNumber').optional().isString().trim().notEmpty().withMessage('each unit needs a serialNumber.'),
  body('units.*.condition').optional().isIn(UNIT_CONDITIONS),
];

export const updateProductRules = [
  uuidParam('id'),
  body('name').optional().isString().trim().notEmpty().isLength({ max: 200 }),
  body('categoryId').optional().isUUID(),
  body('description').optional({ nullable: true }).isString().isLength({ max: 2000 }),
  body('brand').optional({ nullable: true }).isString().isLength({ max: 120 }),
  body('manufacturer').optional({ nullable: true }).isString().isLength({ max: 120 }),
  body('color').optional({ nullable: true }).isString().isLength({ max: 60 }),
  body('size').optional({ nullable: true }).isString().isLength({ max: 60 }),
  body('sku').optional({ nullable: true }).isString().isLength({ max: 60 }),
  body('isRentable').optional().isBoolean(),
  ...rateFields,
];

export const idParamRules = [uuidParam('id')];

// ----- Product units --------------------------------------------------------
export const createUnitRules = [
  uuidParam('id'), // product id (route is /products/:id/units)
  body('serialNumber').isString().trim().notEmpty().withMessage('serialNumber is required.').isLength({ max: 120 }),
  body('condition').optional().isIn(UNIT_CONDITIONS),
  body('status').optional().isIn(UNIT_STATUSES),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 500 }),
];
export const updateUnitRules = [
  uuidParam('unitId'),
  body('condition').optional().isIn(UNIT_CONDITIONS),
  body('status').optional().isIn(UNIT_STATUSES),
  body('notes').optional({ nullable: true }).isString().isLength({ max: 500 }),
];
export const unitIdParamRules = [uuidParam('unitId')];

// ----- Images ---------------------------------------------------------------
export const imageProductParamRules = [uuidParam('id')];
export const imageIdParamRules = [uuidParam('id'), uuidParam('imageId')];

// ----- Pricelist items ------------------------------------------------------
export const listPricelistItemsRules = [
  query('pricelistId').optional().isUUID(),
  query('productId').optional().isUUID(),
];
export const createPricelistItemRules = [
  body('pricelistId').isUUID().withMessage('pricelistId must be a UUID.'),
  body('productId').isUUID().withMessage('productId must be a UUID.'),
  body('durationUnit').isIn(DURATION_UNITS).withMessage(`durationUnit must be one of ${DURATION_UNITS.join(', ')}.`),
  body('rate').isFloat({ min: 0 }).withMessage('rate must be a non-negative number.'),
];
export const updatePricelistItemRules = [
  uuidParam('id'),
  body('rate').isFloat({ min: 0 }).withMessage('rate must be a non-negative number.'),
];
