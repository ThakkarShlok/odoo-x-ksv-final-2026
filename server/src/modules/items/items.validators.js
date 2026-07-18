/**
 * WHAT: Whitelist validators for Item writes. Same mass-assignment defence as auth.validators.
 * The controller reads ONLY `name` and `status`. A client cannot set id, createdById,
 * createdAt, or updatedAt by including them in the body — nothing downstream reads them, and
 * createdById is taken from the token, not the payload.
 */
import { body } from 'express-validator';

// Kept in sync with the Prisma ItemStatus enum by hand. If the enum grows, add the value here
// too — express-validator cannot import the enum, so this is the one unavoidable duplication.
const ITEM_STATUSES = ['ACTIVE', 'INACTIVE'];

export const createItemRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .isLength({ max: 200 })
    .withMessage('Name must be 200 characters or fewer.'),
  body('status')
    .optional()
    .isIn(ITEM_STATUSES)
    .withMessage(`Status must be one of: ${ITEM_STATUSES.join(', ')}.`),
];

export const updateStatusRules = [
  body('status')
    .isIn(ITEM_STATUSES)
    .withMessage(`Status must be one of: ${ITEM_STATUSES.join(', ')}.`),
];
