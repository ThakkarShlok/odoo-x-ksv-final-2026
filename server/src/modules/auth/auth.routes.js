/**
 * Auth routes. The middleware CHAIN on each line is the security story, read left to right.
 *
 *   register/login:  rateLimiter -> validators -> validate -> controller
 *   me:              authMiddleware -> controller
 *   promote:         authMiddleware -> requireRole('ADMIN') -> validators -> validate -> controller
 *
 * The rate limiter sits on the whole router (see app.js mounts it), so every auth attempt is
 * metered. Note promote requires BOTH a valid token (layer 1) AND the ADMIN role (layer 2) —
 * the two-layer chain a reviewer asked about, expressed literally.
 */
import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { registerRules, loginRules, promoteRules } from './auth.validators.js';
import { register, login, me, promote } from './auth.controller.js';

const router = Router();

router.post('/register', registerRules, validate, register);
router.post('/login', loginRules, validate, login);
router.get('/me', authMiddleware, me);
router.post('/promote', authMiddleware, requireRole('ADMIN'), promoteRules, validate, promote);

export default router;
