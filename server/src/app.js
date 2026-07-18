/**
 * WHAT: Builds and exports the Express app. Deliberately does NOT call listen().
 * WHY THIS OVER THE ALTERNATIVE: if app.js bound the port, Supertest could not import it
 *   without starting a real server on a real port — which breaks in CI, breaks when the dev
 *   server is already running, and makes tests race each other. Exporting the app lets
 *   Supertest drive it in-process. server.js owns the port; this file owns the wiring.
 * REVIEWER QUESTION: "How do you test your HTTP layer without a live server?" -> This split.
 *
 * MIDDLEWARE ORDER IS LOAD-BEARING — top to bottom:
 *   helmet -> cors -> morgan -> body parser -> routes -> notFound -> errorHandler
 * Security headers before anything can respond; the 404 after all routes have had their
 * chance; the error handler last, because Express only recognises it as an error handler
 * if it is registered after the routes that throw into it.
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

import { env } from './config/env.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRateLimiter } from './middleware/rateLimit.js';
import healthRoutes from './modules/health/health.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import itemRoutes from './modules/items/items.routes.js';
import notificationRoutes from './modules/notifications/notification.routes.js';

export function createApp() {
  const app = express();

  // Sets X-Frame-Options, X-Content-Type-Options, HSTS, and removes X-Powered-By.
  // We are a JSON API, not an HTML app, so helmet's CSP is left at its default off —
  // there is no document for a CSP to protect. Turn it on if this ever serves HTML.
  app.use(helmet());

  // Locked to one origin, not `*`. `*` is incompatible with credentialed requests anyway,
  // but the real point is that only our known frontend may read responses in a browser.
  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true,
    })
  );

  app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  // Body size cap. The default is 100kb; making it explicit means the limit is a decision
  // rather than a default, and it is the cheapest DoS guard we have against a giant payload.
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/health', healthRoutes);
  // The rate limiter is mounted ONLY on /api/auth — the brute-force target — not globally.
  // A busy authenticated session must never trip it. See middleware/rateLimit.js.
  app.use('/api/auth', authRateLimiter, authRoutes);
  app.use('/api/items', itemRoutes);
  app.use('/api/notifications', notificationRoutes);

  // Order matters: unmatched /api/* -> JSON 404, everything thrown -> single handler.
  app.use('/api', notFound);
  app.use(errorHandler);

  return app;
}
