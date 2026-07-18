import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  listRentalsRules,
  createQuotationRules,
  handoverRules,
  returnScanRules,
  cancelRentalRules,
} from './rentals.validators.js';
import {
  listRentals,
  createQuotation,
  handoverPickup,
  returnScan,
  cancelRental,
} from './rentals.controller.js';

const router = Router();

// Retrieve list of rental orders (scoped to owner if customer)
router.get('/', authMiddleware, listRentalsRules, validate, listRentals);

// Create a draft rental quotation
router.post('/', authMiddleware, createQuotationRules, validate, createQuotation);

// Handoff pickup scan (field agent/admin only)
router.post('/:id/handover', authMiddleware, requireRole('ADMIN', 'FIELD_AGENT'), handoverRules, validate, handoverPickup);

// Return logging scan (field agent/admin only)
router.post('/:id/return-scan', authMiddleware, requireRole('ADMIN', 'FIELD_AGENT'), returnScanRules, validate, returnScan);

// Cancel order prior to pickup (owner / admin / agent)
router.post('/:id/cancel', authMiddleware, cancelRentalRules, validate, cancelRental);

export default router;
