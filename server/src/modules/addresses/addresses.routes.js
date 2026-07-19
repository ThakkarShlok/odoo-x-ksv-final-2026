import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { body } from 'express-validator';
import { listAddresses, createAddress, updateAddress, deleteAddress } from './addresses.controller.js';

const router = Router();

const addressRules = [
  body('line1').trim().notEmpty().withMessage('Address line 1 is required.'),
  body('city').trim().notEmpty().withMessage('City is required.'),
  body('postalCode').trim().notEmpty().withMessage('Postal code is required.'),
  body('type').optional().isIn(['SHIPPING', 'BILLING']),
];

router.get('/', authMiddleware, listAddresses);
router.post('/', authMiddleware, addressRules, validate, createAddress);
router.put('/:id', authMiddleware, addressRules, validate, updateAddress);
router.delete('/:id', authMiddleware, deleteAddress);

export default router;
