import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { listCatalogRules, availabilityRules } from './catalog.validators.js';
import { listCatalog, listCatalogCategories, checkAvailability } from './catalog.controller.js';

const router = Router();

// Public: browsing and availability must work before login (customer demo entry point).
router.get('/', listCatalogRules, validate, listCatalog);
router.get('/categories', listCatalogCategories);
router.get('/availability', availabilityRules, validate, checkAvailability);

export default router;
