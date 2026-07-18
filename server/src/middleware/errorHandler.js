/**
 * WHAT: The single terminal error handler. Every thrown error in the app ends here.
 * WHY THIS OVER THE ALTERNATIVE: per-route try/catch that res.json({ error: err.message })
 *   leaks internals — Prisma's messages contain table names, column names, and sometimes the
 *   connection string. Here, only errors WE raised (AppError) have their message forwarded;
 *   anything else becomes a generic 500 and the detail goes to the server log instead.
 * REVIEWER QUESTION: "Can a stack trace reach the client in production?"
 *   -> No. `stack` is attached only when NODE_ENV !== 'production', and unknown errors never
 *      forward their message regardless of environment.
 *
 * NOTE ON EXPRESS 5: async route handlers that reject are forwarded here automatically.
 * Express 4 needed express-async-handler or a wrapper for that; Express 5 does it natively,
 * which is why no such wrapper exists in this codebase.
 */
import { env } from '../config/env.js';
import { AppError } from '../lib/apiResponse.js';
import { mapPrismaError } from '../lib/prismaErrors.js';

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity (4).
export function errorHandler(err, req, res, next) {
  // A database constraint we deliberately rely on? Translate it to its real status.
  const mapped = err instanceof AppError ? err : (mapPrismaError(err) ?? err);

  const isKnown = mapped instanceof AppError;
  const status = isKnown ? mapped.status : 500;

  // Unknown errors are logged in full server-side and generalised client-side.
  if (!isKnown) {
    console.error('[unhandled]', {
      method: req.method,
      path: req.originalUrl,
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
    });
  }

  const body = {
    success: false,
    message: isKnown ? mapped.message : 'Internal server error',
    ...(isKnown && mapped.errors ? { errors: mapped.errors } : {}),
  };

  // Stack traces are a development affordance only.
  if (!env.isProduction && !isKnown) {
    body.stack = err?.stack;
  }

  res.status(status).json(body);
}
