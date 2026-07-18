/**
 * WHAT: Builds and exports the Express app. Deliberately does NOT call listen().
 * WHY THIS OVER THE ALTERNATIVE: if app.js bound the port, Supertest could not import it
 *   without starting a real server on a real port — which breaks in CI, breaks when the dev
 *   server is already running, and makes tests race each other. Exporting the app lets
 *   Supertest drive it in-process. server.js owns the port; this file owns the wiring.
 *
 * MIDDLEWARE ORDER IS LOAD-BEARING — top to bottom:
 *   helmet -> cors -> morgan -> body parser -> routes -> notFound -> errorHandler
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

import { env } from './config/env.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRateLimiter } from './middleware/rateLimit.js';

// Module routing imports
import healthRoutes from './modules/health/health.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import itemRoutes from './modules/items/items.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';

import usersRoutes from './modules/users/users.routes.js';
import productsRoutes from './modules/products/products.routes.js';
import inventoryRoutes from './modules/inventory/inventory.routes.js';
import rentalsRoutes from './modules/rentals/rentals.routes.js';
import paymentsRoutes from './modules/payments/payments.routes.js';
import depositsRoutes from './modules/deposits/deposits.routes.js';
import inspectionsRoutes from './modules/inspections/inspections.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import aiRoutes from './modules/ai/ai.routes.js';

export function createApp() {
  const app = express();

  app.use(helmet());

  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true,
    })
  );

  app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  app.use(express.json({ limit: '100kb' }));

  // ==================== BASE ROUTING MOUNTS ====================
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRateLimiter, authRoutes);
  app.use('/api/items', itemRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.use('/api/users', usersRoutes);
  app.use('/api/products', productsRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/rentals', rentalsRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/deposits', depositsRoutes);
  app.use('/api/inspections', inspectionsRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/ai', aiRoutes);

  // ==================== V1 ROUTING ALIASES ====================
  app.use('/api/v1/health', healthRoutes);
  app.use('/api/v1/auth', authRateLimiter, authRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/products', productsRoutes);
  app.use('/api/v1/inventory', inventoryRoutes);
  app.use('/api/v1/rentals', rentalsRoutes);
  app.use('/api/v1/payments', paymentsRoutes);
  app.use('/api/v1/deposits', depositsRoutes);
  app.use('/api/v1/inspections', inspectionsRoutes);
  app.use('/api/v1/reports', reportsRoutes);
  app.use('/api/v1/ai', aiRoutes);
  app.use('/api/v1/notifications', notificationRoutes);

  // Order matters: unmatched /api/* -> JSON 404, everything thrown -> single handler.
  app.use('/api', notFound);
  app.use(errorHandler);

  return app;
}
