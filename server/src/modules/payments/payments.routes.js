import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  authorizeRules,
  chargeRules,
  listPaymentsRules,
} from './payments.validators.js';
import {
  authorizePayment,
  chargePenalty,
  listPayments,
} from './payments.controller.js';

const router = Router();

// Submits checkout funds authorization
router.post('/authorize', authMiddleware, authorizeRules, validate, authorizePayment);

// Charge outstanding penalty invoices (admin-only)
router.post('/:orderId/charge-penalty', authMiddleware, requireRole('ADMIN'), chargeRules, validate, chargePenalty);

// Retrieve payment transaction history logs (admin-only)
router.get('/', authMiddleware, requireRole('ADMIN'), listPaymentsRules, validate, listPayments);

export default router;
