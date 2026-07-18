/**
 * Item routes. The whole router is authenticated: router.use(authMiddleware) means there is no
 * anonymous access to items at all — read included. (In Phase 0 GET was open to prove the pipe
 * with curl; Phase 1 closes it now that auth exists.)
 *
 * Role policy, stated so a reviewer can see the decision:
 *   - list / create / update-status: any authenticated user (EMPLOYEE and up).
 *   - No requireRole here, because "who may create an item" is a domain decision that arrives
 *     tomorrow. The HOOK is ready: add requireRole('MANAGER','ADMIN') to any line to gate it,
 *     and requireRole is already imported below to make that a one-word change.
 */
import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
// eslint-disable-next-line no-unused-vars -- imported so gating a route tomorrow is one word.
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { createItemRules, updateStatusRules } from './items.validators.js';
import { listItems, createItem, updateStatus } from './items.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', listItems);
router.post('/', createItemRules, validate, createItem);
router.patch('/:id/status', updateStatusRules, validate, updateStatus);

export default router;
