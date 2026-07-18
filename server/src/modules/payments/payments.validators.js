import { body, query, param } from 'express-validator';

export const createOrderRules = [
  body('orderId').isUUID().withMessage('orderId must be a valid UUID.'),
];

export const verifyRules = [
  body('orderId').isUUID().withMessage('orderId must be a valid UUID.'),
  body('razorpayOrderId').trim().notEmpty().withMessage('razorpayOrderId is required.'),
  body('razorpayPaymentId').trim().notEmpty().withMessage('razorpayPaymentId is required.'),
  body('razorpaySignature').trim().notEmpty().withMessage('razorpaySignature is required.'),
];

export const chargeRules = [
  param('orderId').isUUID().withMessage('orderId must be a valid UUID.'),
  body('paymentMethodToken').trim().notEmpty().withMessage('paymentMethodToken is required.'),
];

export const listPaymentsRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),
];
