/**
 * WHAT: Process entrypoint. Validates env (via the import of config/env.js), binds the port,
 *   and shuts down cleanly.
 * WHY SEPARATE FROM app.js: see the header of app.js — testability. This file is the only
 *   place in the codebase that knows a port exists.
 */
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { createApp } from './app.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`[zenith] API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  console.log(`[zenith] CORS origin allowed: ${env.clientOrigin}`);
});

/**
 * Graceful shutdown: stop accepting new connections, then release the Prisma pool.
 * Without the $disconnect, Postgres keeps the connections open until they time out — and
 * on Windows `node --watch` restarts fast enough to leak a pool per save, which eventually
 * hits max_connections and produces a "too many clients" error that looks like a code bug.
 */
async function shutdown(signal) {
  console.log(`[zenith] ${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
