import { body, query, param } from 'express-validator';

export const listAssetsRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),
  query('status').optional().isIn(['AVAILABLE', 'RESERVED', 'RENTED', 'MAINTENANCE', 'DAMAGED', 'RETIRED']).withMessage('Invalid status filter.'),
  query('brand').optional().trim().isString(),
  query('categoryId').optional().isUUID().withMessage('categoryId must be a valid UUID.'),
];

export const addAssetRules = [
  body('barcode').trim().notEmpty().withMessage('Barcode is required.'),
  body('brand').trim().notEmpty().withMessage('Brand is required.'),
  body('manufacturer').trim().notEmpty().withMessage('Manufacturer is required.'),
  body('color').trim().notEmpty().withMessage('Color is required.'),
  body('size').trim().notEmpty().withMessage('Size is required.'),
  body('categoryId').isUUID().withMessage('categoryId must be a valid UUID.'),
];

export const getBarcodeRules = [
  param('barcode').trim().notEmpty().withMessage('Barcode parameter is required.'),
];

export const ingestTelemetryRules = [
  param('id').isUUID().withMessage('Asset id must be a valid UUID.'),
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90.'),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180.'),
  body('velocity').isFloat({ min: 0 }).withMessage('Velocity must be a positive decimal.'),
  body('battery').isFloat({ min: 0, max: 100 }).withMessage('Battery must be between 0 and 100.'),
];

export const getTelemetryRules = [
  param('id').isUUID().withMessage('Asset id must be a valid UUID.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),
];
