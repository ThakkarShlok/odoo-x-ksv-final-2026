import { body, query, param } from 'express-validator';

export const updateProfileRules = [
  body('fullName').optional().trim().isLength({ max: 120 }).withMessage('Name too long.'),
  body('phoneNumber').optional().trim(),
  body('address').optional().trim(),
  body('profileImageUrl').optional().trim().isURL().withMessage('Invalid profile image URL.'),
];

export const listUsersRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),
  query('role').optional().isIn(['CUSTOMER', 'ADMIN']).withMessage('Invalid role filter.'),
  query('search').optional().trim().isString(),
];

export const updateRoleRules = [
  param('id').isUUID().withMessage('Invalid user ID format.'),
  body('role').isIn(['CUSTOMER', 'ADMIN']).withMessage('Invalid target role.'),
];

export const deleteUserRules = [
  param('id').isUUID().withMessage('Invalid user ID format.'),
];
