import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { downloadInvoice } from './invoices.controller.js';

const router = Router();

router.get('/:id/download', authMiddleware, downloadInvoice);

export default router;
