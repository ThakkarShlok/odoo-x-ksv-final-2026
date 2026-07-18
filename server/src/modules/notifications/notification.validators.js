import { body, query } from 'express-validator';

export const listNotificationsRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),
];

export const sendReminderRules = [
  body('orderId').isUUID().withMessage('orderId must be a valid UUID.'),
  body('notificationType').isIn(['PRE_RETURN_24H', 'OVERDUE_ALERT_1H']).withMessage('Invalid notificationType.'),
];
