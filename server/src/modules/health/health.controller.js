/**
 * WHAT: Two distinct health checks.
 *   GET /api/health          — is the Node process up? (liveness)
 *   GET /api/health/database — can we actually reach Postgres? (readiness)
 * WHY TWO AND NOT ONE: they answer different questions and have different failure responses.
 *   A liveness check that also hits the DB will report the *app* as dead during a transient
 *   DB blip, and an orchestrator would restart a perfectly healthy process. Splitting them
 *   means "app up, database down" is a state we can actually observe — which is exactly the
 *   state the System Status page is built to show.
 * REVIEWER QUESTION: "Is your DB health check real or does it just return 200?"
 *   -> Real. It executes SELECT 1 through the same Prisma pool the app uses, and reports the
 *      measured round-trip. A hardcoded 200 would be worse than no check at all: it would
 *      actively lie during an outage.
 */
import { prisma } from '../../config/prisma.js';
import { ok } from '../../lib/apiResponse.js';

export function health(req, res) {
  return ok(res, {
    message: 'Server is healthy',
    data: { status: 'healthy', uptimeSeconds: Math.floor(process.uptime()) },
    meta: { checkedAt: new Date().toISOString() },
  });
}

export async function databaseHealth(req, res) {
  const startedAt = Date.now();
  try {
    // The cheapest query that still proves the whole path works: pool -> socket -> postgres
    // -> parse -> respond. $queryRaw with a tagged template is parameterised by Prisma;
    // there is no interpolated input here in any case.
    await prisma.$queryRaw`SELECT 1`;

    return ok(res, {
      message: 'Database is reachable',
      data: { status: 'healthy', latencyMs: Date.now() - startedAt },
      meta: { checkedAt: new Date().toISOString() },
    });
  } catch (err) {
    // 503, not 500: the service is correct but a dependency is unavailable. That distinction
    // is what tells a load balancer to stop routing here rather than page someone.
    console.error('[health:database]', err?.message);

    // Deliberately NOT forwarding err.message. Prisma's connection errors embed the full
    // DATABASE_URL — including the password — and this endpoint is unauthenticated.
    return res.status(503).json({
      success: false,
      message: 'Database is unreachable',
      errors: [{ field: 'database', message: 'Connection failed' }],
    });
  }
}
