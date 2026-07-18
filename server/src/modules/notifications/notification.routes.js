/**
 * Notification routes. Every one is behind authMiddleware — there is no such thing as an
 * anonymous notification. No requireRole: any authenticated user manages their OWN
 * notifications regardless of role; the ownership scoping is in the controller, not the role.
 */
import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { listNotifications, markRead, markAllRead } from './notification.controller.js';

const router = Router();

router.use(authMiddleware); // applies to every route below — one line, whole router protected

router.get('/', listNotifications);
// '/read-all' (one path segment) and '/:id/read' (two segments) cannot collide, so order
// between them is not load-bearing here. Kept adjacent for readability, not for correctness.
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);

export default router;
