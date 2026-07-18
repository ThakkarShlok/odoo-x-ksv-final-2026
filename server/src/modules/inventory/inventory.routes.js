import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  listAssetsRules,
  addAssetRules,
  getBarcodeRules,
  ingestTelemetryRules,
  getTelemetryRules,
} from './inventory.validators.js';
import {
  listAssets,
  addAsset,
  getAssetByBarcode,
  ingestTelemetry,
  getTelemetry,
} from './inventory.controller.js';

const router = Router();

// Retrieve all assets (accessible to admins and field agents)
router.get('/', authMiddleware, requireRole('ADMIN', 'FIELD_AGENT'), listAssetsRules, validate, listAssets);

// Create asset (admin-only)
router.post('/', authMiddleware, requireRole('ADMIN'), addAssetRules, validate, addAsset);

// Scan barcode (accessible to customers, field agents, and admins)
router.get('/barcode/:barcode', authMiddleware, getBarcodeRules, validate, getAssetByBarcode);

// Ingest telemetry logs (public IoT stream entrypoint with payload validation)
router.post('/:id/telemetry', ingestTelemetryRules, validate, ingestTelemetry);

// Fetch telemetry logs (accessible to admins and field agents)
router.get('/:id/telemetry', authMiddleware, requireRole('ADMIN', 'FIELD_AGENT'), getTelemetryRules, validate, getTelemetry);

export default router;
