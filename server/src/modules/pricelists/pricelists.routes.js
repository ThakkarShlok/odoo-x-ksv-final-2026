import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { query, body, param } from 'express-validator';
import {
  listPricelists, getPricelist, createPricelist, updatePricelist, deletePricelist,
  addPricelistItem, removePricelistItem,
} from './pricelists.controller.js';

const router = Router();

const listRules = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

const createRules = [
  body('name').trim().notEmpty().withMessage('Name is required.'),
  body('validFrom').optional({ nullable: true }).isISO8601(),
  body('validTo').optional({ nullable: true }).isISO8601(),
  body('isDefault').optional().isBoolean(),
];

const itemRules = [
  body('productId').isUUID().withMessage('productId must be a valid UUID.'),
  body('durationUnit').isIn(['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY']).withMessage('Invalid durationUnit.'),
  body('rate').isFloat({ min: 0 }).withMessage('rate must be a positive number.'),
];

router.get('/', authMiddleware, listRules, validate, listPricelists);
router.get('/:id', authMiddleware, getPricelist);
router.post('/', authMiddleware, requireRole('ADMIN'), createRules, validate, createPricelist);
router.put('/:id', authMiddleware, requireRole('ADMIN'), createRules, validate, updatePricelist);
router.delete('/:id', authMiddleware, requireRole('ADMIN'), deletePricelist);

// Pricelist items
router.post('/:id/items', authMiddleware, requireRole('ADMIN'), itemRules, validate, addPricelistItem);
router.delete('/:id/items/:itemId', authMiddleware, requireRole('ADMIN'), removePricelistItem);

export default router;
