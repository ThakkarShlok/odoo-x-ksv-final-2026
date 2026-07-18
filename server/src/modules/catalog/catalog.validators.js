/**
 * Validators for the customer-facing catalogue. Query-param whitelist (mass-assignment defence
 * applies to reads too: only these params are read by the controller).
 */
import { query } from 'express-validator';

export const listCatalogRules = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('categoryId').optional().isUUID().withMessage('categoryId must be a UUID.'),
  query('search').optional().isString().trim(),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('minPrice must be a non-negative number.'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('maxPrice must be a non-negative number.'),
  query('sort').optional().isIn(['name', 'newest', 'price_asc', 'price_desc']).withMessage('sort must be name, newest, price_asc, or price_desc.'),
  // Availability window is all-or-nothing: filtering by date needs both endpoints. The pairing
  // check lives on BOTH params because .optional() skips the chain when a field is absent — so
  // "from without to" is caught by from's custom, and vice-versa.
  query('from')
    .optional()
    .isISO8601().withMessage('from must be an ISO-8601 datetime.')
    .custom((_from, { req }) => {
      if (!req.query.to) throw new Error('from and to must be provided together.');
      return true;
    }),
  query('to')
    .optional()
    .isISO8601().withMessage('to must be an ISO-8601 datetime.')
    .custom((to, { req }) => {
      if (!req.query.from) throw new Error('from and to must be provided together.');
      if (new Date(to) <= new Date(req.query.from)) throw new Error('to must be after from.');
      return true;
    }),
];

export const availabilityRules = [
  query('productId').isUUID().withMessage('productId is required and must be a UUID.'),
  query('from').isISO8601().withMessage('from must be an ISO-8601 datetime.'),
  query('to').isISO8601().withMessage('to must be an ISO-8601 datetime.'),
];
