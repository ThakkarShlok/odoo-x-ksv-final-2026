import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { getDashboardKpi, getForecasts, getProfitLossReport } from './reports.controller.js';

const router = Router();

// Retrieve operations dashboard analytics stats (admin-only)
router.get('/dashboard', authMiddleware, requireRole('ADMIN'), getDashboardKpi);

// Retrieve demand availability forecasting report (admin-only)
router.get('/forecasting', authMiddleware, requireRole('ADMIN'), getForecasts);

// Retrieve Profit & Loss report (admin-only)
router.get('/profit-loss', authMiddleware, requireRole('ADMIN'), getProfitLossReport);

export default router;
