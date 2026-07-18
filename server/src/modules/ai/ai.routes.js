import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { listTicketsRules, resolveTicketRules } from './ai.validators.js';
import {
  evaluateMaintenance,
  listMaintenanceTickets,
  resolveMaintenanceTicket,
} from './ai.controller.js';

const router = Router();

// Evaluate mechanical wear ceiling limits (field agent/admin only)
router.post('/maintenance/evaluate', authMiddleware, requireRole('ADMIN', 'FIELD_AGENT'), evaluateMaintenance);

// List predictive maintenance tickets (field agent/admin only)
router.get('/maintenance/tickets', authMiddleware, requireRole('ADMIN', 'FIELD_AGENT'), listTicketsRules, validate, listMaintenanceTickets);

// Resolve maintenance work ticket (field agent/admin only)
router.post('/maintenance/tickets/:id/resolve', authMiddleware, requireRole('ADMIN', 'FIELD_AGENT'), resolveTicketRules, validate, resolveMaintenanceTicket);

export default router;
