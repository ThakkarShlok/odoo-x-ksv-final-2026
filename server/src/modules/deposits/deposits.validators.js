import { body, param } from 'express-validator';

export const getDepositRules = [
  param('orderId').isUUID().withMessage('orderId must be a valid UUID.'),
];

export const reconcileRules = [
  param('id').isUUID().withMessage('Deposit or Order ID must be a valid UUID.'),
];

export const overrideRules = [
  param('id').isUUID().withMessage('Deposit or Order ID must be a valid UUID.'),
  body('overrideAmount').isFloat({ min: 0 }).withMessage('overrideAmount must be a positive decimal.'),
  body('rationale').trim().notEmpty().withMessage('rationale is required.'),
];
