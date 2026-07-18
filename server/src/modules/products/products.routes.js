import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  listCategoriesRules,
  createCategoryRules,
  createPricelistRules,
  createTemplateRules,
} from './products.validators.js';
import {
  listCategories,
  createCategory,
  createPricelist,
  createQuotationTemplate,
} from './products.controller.js';

const router = Router();

// Publicly browse catalog categories
router.get('/', listCategoriesRules, validate, listCategories);

// Admin configurations
router.post('/', authMiddleware, requireRole('ADMIN'), createCategoryRules, validate, createCategory);
router.post('/pricelists', authMiddleware, requireRole('ADMIN'), createPricelistRules, validate, createPricelist);
router.post('/quotation-templates', authMiddleware, requireRole('ADMIN'), createTemplateRules, validate, createQuotationTemplate);

export default router;
