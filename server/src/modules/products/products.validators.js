import { body, query } from 'express-validator';

export const listCategoriesRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),
  query('search').optional().trim().isString(),
];

export const createCategoryRules = [
  body('name').trim().notEmpty().withMessage('Category name is required.'),
  body('depositMethod').isIn(['FIXED', 'PERCENTAGE']).withMessage('depositMethod must be FIXED or PERCENTAGE.'),
  body('depositValue').isFloat({ min: 0 }).withMessage('depositValue must be a positive number.'),
  body('baseHourlyRate').isFloat({ min: 0 }).withMessage('baseHourlyRate must be a positive number.'),
  body('baseDailyRate').isFloat({ min: 0 }).withMessage('baseDailyRate must be a positive number.'),
];

export const createPricelistRules = [
  body('name').trim().notEmpty().withMessage('Pricelist name is required.'),
  body('description').optional().trim(),
  body('startDate').isISO8601().withMessage('startDate must be a valid ISO8601 date.'),
  body('endDate').isISO8601().withMessage('endDate must be a valid ISO8601 date.'),
  body('rules').optional().isArray().withMessage('rules must be an array.'),
  body('rules.*.categoryId').isUUID().withMessage('categoryId must be a valid UUID.'),
  body('rules.*.overrideHourlyRate').isFloat({ min: 0 }).withMessage('overrideHourlyRate must be a positive number.'),
  body('rules.*.overrideDailyRate').isFloat({ min: 0 }).withMessage('overrideDailyRate must be a positive number.'),
];

export const createTemplateRules = [
  body('name').trim().notEmpty().withMessage('Template name is required.'),
  body('headerContent').trim().notEmpty().withMessage('headerContent is required.'),
  body('footerContent').trim().notEmpty().withMessage('footerContent is required.'),
];
