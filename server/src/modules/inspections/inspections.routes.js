import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  submitInspectionRules,
  signatureRules,
} from './inspections.validators.js';
import {
  submitInspection,
  getUploadSignature,
} from './inspections.controller.js';

const router = Router();

// Submit return inspection checks (field agent/admin only)
router.post('/', authMiddleware, requireRole('ADMIN', 'FIELD_AGENT'), submitInspectionRules, validate, submitInspection);

// Retrieve Cloudinary direct signed upload credentials (all authenticated users)
router.post('/upload-signature', authMiddleware, signatureRules, validate, getUploadSignature);

export default router;
