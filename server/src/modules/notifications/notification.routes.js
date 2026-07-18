import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { listNotificationsRules, sendReminderRules } from './notification.validators.js';
import {
  listNotifications,
  markRead,
  markAllRead,
  sendManualReminder,
} from './notification.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listNotificationsRules, validate, listNotifications);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);

// Manual trigger queues (admin-only)
router.post('/send-reminder', requireRole('ADMIN'), sendReminderRules, validate, sendManualReminder);

export default router;
