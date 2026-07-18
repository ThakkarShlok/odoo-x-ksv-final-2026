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

// DEPRECATION SIGNAL — emitted on every response from this router. `Deprecation` (RFC 8594) marks
// the endpoint as deprecated; `Link rel="successor-version"` points at what replaced it; `Sunset`
// advertises when it may be removed. A reviewer (or a client author) sees the reasoning in the
// response headers, not just by reading the controller. See products.controller.js header for why
// it is still mounted at all.
router.use((_req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Link', '</api/admin>; rel="successor-version", </api/catalog>; rel="successor-version"');
  res.set('Sunset', 'Sat, 01 Nov 2026 00:00:00 GMT');
  res.set('Warning', '299 - "Deprecated API: use /api/admin (management) and /api/catalog (storefront)."');
  next();
});

// Publicly browse catalog categories
router.get('/', listCategoriesRules, validate, listCategories);

// Admin configurations
router.post('/', authMiddleware, requireRole('ADMIN'), createCategoryRules, validate, createCategory);
router.post('/pricelists', authMiddleware, requireRole('ADMIN'), createPricelistRules, validate, createPricelist);
router.post('/quotation-templates', authMiddleware, requireRole('ADMIN'), createTemplateRules, validate, createQuotationTemplate);

export default router;
