import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { updateSettingsRules } from './settings.validators.js';
import { getSettings, updateSettings } from './settings.controller.js';

const router = Router();

// Any authenticated user can read settings (customers need deposit info in catalog)
router.get('/', authMiddleware, getSettings);

// Only admin can update settings
router.put('/', authMiddleware, requireRole('ADMIN'), updateSettingsRules, validate, updateSettings);

export default router;
