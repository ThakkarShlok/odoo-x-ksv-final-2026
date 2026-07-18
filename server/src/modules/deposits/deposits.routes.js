import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  getDepositRules,
  reconcileRules,
  overrideRules,
} from './deposits.validators.js';
import {
  getDepositDetails,
  reconcileDeposit,
  overrideDeposit,
} from './deposits.controller.js';

const router = Router();

// Retrieve deposit logs
router.get('/order/:orderId', authMiddleware, getDepositRules, validate, getDepositDetails);

// Settle deposit (field agent/admin)
router.post('/:id/reconcile', authMiddleware, requireRole('ADMIN', 'FIELD_AGENT'), reconcileRules, validate, reconcileDeposit);

// Admin-override deposit adjustment (admin-only)
router.post('/:id/override', authMiddleware, requireRole('ADMIN'), overrideRules, validate, overrideDeposit);

export default router;
