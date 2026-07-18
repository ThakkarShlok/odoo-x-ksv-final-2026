import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  updateProfileRules,
  listUsersRules,
  updateRoleRules,
  deleteUserRules,
} from './users.validators.js';
import {
  getProfile,
  updateProfile,
  listUsers,
  updateUserRole,
  deleteUser,
} from './users.controller.js';

const router = Router();

// Profile operations are open to any authenticated user
router.get('/profile', authMiddleware, getProfile);
router.patch('/profile', authMiddleware, updateProfileRules, validate, updateProfile);

// Admin-only directories operations
router.get('/', authMiddleware, requireRole('ADMIN'), listUsersRules, validate, listUsers);
router.patch('/:id/role', authMiddleware, requireRole('ADMIN'), updateRoleRules, validate, updateUserRole);
router.delete('/:id', authMiddleware, requireRole('ADMIN'), deleteUserRules, validate, deleteUser);

export default router;
