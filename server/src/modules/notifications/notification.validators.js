import { body, query } from 'express-validator';

export const listNotificationsRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),
  query('readStatus').optional().isIn(['ALL', 'READ', 'UNREAD']).withMessage('readStatus must be ALL, READ, or UNREAD.'),
  query('scope').optional().isIn(['MINE', 'ALL']).withMessage('scope must be MINE or ALL.'),
  query('type').optional().isString().trim().notEmpty().withMessage('type must be a non-empty string.'),
];

export const sendReminderRules = [
  body('orderId').isUUID().withMessage('orderId must be a valid UUID.'),
  body('notificationType')
    .isIn(['PRE_RETURN_24H', 'OVERDUE_ALERT_1H', 'PICKUP_DUE_TOMORROW', 'RETURN_DUE_TOMORROW', 'RETURN_OVERDUE'])
    .withMessage('Invalid notificationType.'),
];
