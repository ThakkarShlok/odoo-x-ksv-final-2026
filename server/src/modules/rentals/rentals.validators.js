import { body, query, param } from 'express-validator';

export const listRentalsRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),
  query('status').optional().isIn(['QUOTATION', 'CONFIRMED', 'PICKED_UP', 'IN_RENTAL', 'RETURNED', 'CLOSED', 'CANCELLED']).withMessage('Invalid status filter.'),
  query('customerId').optional().isUUID().withMessage('customerId must be a valid UUID.'),
];

export const createQuotationRules = [
  body('rentalStart').isISO8601().withMessage('rentalStart must be a valid ISO8601 date.'),
  body('rentalEnd').isISO8601().withMessage('rentalEnd must be a valid ISO8601 date.'),
  body('fulfillmentMethod').isIn(['STORE_PICKUP', 'DELIVERY']).withMessage('fulfillmentMethod must be STORE_PICKUP or DELIVERY.'),
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array.'),
  body('items.*.assetId').optional({ nullable: true }).isUUID().withMessage('Each item assetId must be a valid UUID.'),
  body('items.*.categoryId').optional({ nullable: true }).isUUID().withMessage('Each item categoryId must be a valid UUID.'),
  body('customerId').optional().isUUID().withMessage('customerId must be a valid UUID.'),
];

export const handoverRules = [
  param('id').isUUID().withMessage('Order id must be a valid UUID.'),
  body('barcodes').isArray({ min: 1 }).withMessage('barcodes must be a non-empty array.'),
  body('barcodes.*').isString().withMessage('barcodes must contain strings.'),
];

export const returnScanRules = [
  param('id').isUUID().withMessage('Order id must be a valid UUID.'),
  body('barcodes').isArray({ min: 1 }).withMessage('barcodes must be a non-empty array.'),
  body('barcodes.*').isString().withMessage('barcodes must contain strings.'),
];

export const cancelRentalRules = [
  param('id').isUUID().withMessage('Order id must be a valid UUID.'),
];
