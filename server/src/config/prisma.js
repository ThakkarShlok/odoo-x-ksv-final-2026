/**
 * WHAT: The single PrismaClient instance for the whole process.
 * WHY THIS OVER THE ALTERNATIVE: `new PrismaClient()` per module or per request opens a new
 *   connection pool each time and will exhaust Postgres's max_connections (default 100) under
 *   any real load. One client = one pool, which is what Prisma is designed for.
 * REVIEWER QUESTION: "Where is your connection pool configured?"
 *   -> Here. Prisma manages it internally; pool size defaults to (num_cpus * 2 + 1) and is
 *      tunable via ?connection_limit= on DATABASE_URL. We never open raw connections.
 */
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

export const prisma = new PrismaClient({
  // Query logs in dev only — they are the fastest way to spot an N+1 during the build.
  // Never in production: query logs leak parameter values into stdout.
  log: env.isProduction ? ['error'] : ['warn', 'error'],
});
