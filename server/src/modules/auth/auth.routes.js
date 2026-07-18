import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { registerRules, loginRules, promoteRules } from './auth.validators.js';
import { register, login, me, promote, refresh, logout } from './auth.controller.js';

const router = Router();

router.post('/register', registerRules, validate, register);
router.post('/login', loginRules, validate, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authMiddleware, me);
router.post('/promote', authMiddleware, requireRole('ADMIN'), promoteRules, validate, promote);

export default router;
