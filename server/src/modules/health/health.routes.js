import { Router } from 'express';
import { health, databaseHealth } from './health.controller.js';

const router = Router();

// Both unauthenticated on purpose: a health check that needs a token is useless to the
// monitor that is checking whether auth is down. Neither endpoint returns any data an
// anonymous caller could not already infer from the server answering at all.
router.get('/', health);
router.get('/database', databaseHealth);

export default router;
