import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  createOrderRules,
  verifyRules,
  chargeRules,
  listPaymentsRules,
} from './payments.validators.js';
import {
  createPaymentOrder,
  verifyPayment,
  chargePenalty,
  listPayments,
} from './payments.controller.js';

const router = Router();

// Create a Razorpay order for rental total + deposit. The browser may open Checkout only with the
// returned order id and public key; it never sees the secret.
router.post('/create-order', authMiddleware, createOrderRules, validate, createPaymentOrder);

// Verify Razorpay's HMAC signature server-side before any business state changes. This is the
// trust boundary: client-reported "success" is not enough.
router.post('/verify', authMiddleware, verifyRules, validate, verifyPayment);

// Charge outstanding penalty invoices (admin-only)
router.post('/:orderId/charge-penalty', authMiddleware, requireRole('ADMIN'), chargeRules, validate, chargePenalty);

// Retrieve payment transaction history logs (admin-only)
router.get('/', authMiddleware, requireRole('ADMIN'), listPaymentsRules, validate, listPayments);

export default router;
