import { body, query, param } from 'express-validator';

export const listTicketsRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.'),
];

export const resolveTicketRules = [
  param('id').trim().notEmpty().withMessage('Ticket ID is required.'),
  body('notes').trim().notEmpty().withMessage('notes are required.'),
  body('cost').isFloat({ min: 0 }).withMessage('cost must be a positive decimal.'),
];
