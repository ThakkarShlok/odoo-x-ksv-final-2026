import { body } from 'express-validator';

export const updateSettingsRules = [
  body('depositRuleType').isIn(['PERCENTAGE', 'FLAT']).withMessage('depositRuleType must be PERCENTAGE or FLAT.'),
  body('depositValue').isFloat({ min: 0 }).withMessage('depositValue must be a positive number.'),
  body('gracePeriodHours').isInt({ min: 0 }).withMessage('gracePeriodHours must be a non-negative integer.'),
  body('lateFeeRuleType').isIn(['PER_DAY_FLAT', 'PER_DAY_PERCENTAGE', 'FLAT']).withMessage('Invalid lateFeeRuleType.'),
  body('lateFeeValue').isFloat({ min: 0 }).withMessage('lateFeeValue must be a positive number.'),
  body('maxLateFeeCap').isFloat({ min: 0 }).withMessage('maxLateFeeCap must be a positive number.'),
];
