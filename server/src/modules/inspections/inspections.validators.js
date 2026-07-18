import { body } from 'express-validator';

export const submitInspectionRules = [
  body('orderId').isUUID().withMessage('orderId must be a valid UUID.'),
  body('assetId').isUUID().withMessage('assetId must be a valid UUID.'),
  body('physicalCondition').isIn(['FLAWLESS', 'SCRATCHED', 'DAMAGED']).withMessage('physicalCondition must be FLAWLESS, SCRATCHED, or DAMAGED.'),
  body('accessoriesComplete').isBoolean().withMessage('accessoriesComplete must be a boolean.'),
  body('damageLogged').isBoolean().withMessage('damageLogged must be a boolean.'),
  body('damageNotes').optional().trim(),
  body('damagePhotoUrl').optional().trim(),
];

export const signatureRules = [
  body('folder').trim().notEmpty().withMessage('folder name is required.'),
];
