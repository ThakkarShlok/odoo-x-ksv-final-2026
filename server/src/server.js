/**
 * WHAT: Process entrypoint. Validates env (via the import of config/env.js), binds the port,
 *   and shuts down cleanly.
 * WHY SEPARATE FROM app.js: see the header of app.js — testability. This file is the only
 *   place in the codebase that knows a port exists.
 */
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { createApp } from './app.js';
import { notificationService } from './modules/notifications/notification.service.js';

const app = createApp();
const REMINDER_SWEEP_MS = 30_000;

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

async function runReminderSweep() {
  const now = new Date();
  const tomorrowStart = startOfDay(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const dayAfterTomorrowStart = new Date(tomorrowStart);
  dayAfterTomorrowStart.setDate(dayAfterTomorrowStart.getDate() + 1);

  const [pickupDueTomorrow, returnDueTomorrow, overdueReturns] = await Promise.all([
    prisma.rentalOrder.findMany({
      where: {
        status: 'CONFIRMED',
        rentalStart: {
          gte: tomorrowStart,
          lt: dayAfterTomorrowStart,
        },
      },
    }),
    prisma.rentalOrder.findMany({
      where: {
        status: 'IN_RENTAL',
        rentalEnd: {
          gte: tomorrowStart,
          lt: dayAfterTomorrowStart,
        },
      },
    }),
    prisma.rentalOrder.findMany({
      where: {
        status: 'IN_RENTAL',
        rentalEnd: { lt: now },
      },
    }),
  ]);

  for (const order of pickupDueTomorrow) {
    await notificationService.notifyOrderPartiesOnce({
      order,
      type: 'PICKUP_DUE_TOMORROW',
      message: `Order ${order.orderNumber} is scheduled for pickup tomorrow.`,
      entityRef: `order:${order.id}`,
    });
  }

  for (const order of returnDueTomorrow) {
    await notificationService.notifyOrderPartiesOnce({
      order,
      type: 'RETURN_DUE_TOMORROW',
      message: `Order ${order.orderNumber} is due back tomorrow.`,
      entityRef: `order:${order.id}`,
    });
  }

  for (const order of overdueReturns) {
    await notificationService.notifyOrderPartiesOnce({
      order,
      type: 'RETURN_OVERDUE',
      message: `Order ${order.orderNumber} is overdue and requires immediate return follow-up.`,
      entityRef: `order:${order.id}`,
    });
  }
}

const server = app.listen(env.port, () => {
  console.log(`[zenith] API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  console.log(`[zenith] CORS origin allowed: ${env.clientOrigin}`);
});

// Polling is deliberate for the hackathon build: a small in-process setInterval keeps reminder
// delivery easy to explain in review. The idempotency boundary lives in createIfAbsent, so the
// same overdue order can be swept repeatedly without generating duplicate rows. Task 5 plugs email
// delivery into this same path, keeping mail failures non-blocking for business transactions.
const reminderInterval = setInterval(() => {
  runReminderSweep().catch((error) => {
    console.error('[notifications] reminder sweep failed', error);
  });
}, REMINDER_SWEEP_MS);

/**
 * Graceful shutdown: stop accepting new connections, then release the Prisma pool.
 * Without the $disconnect, Postgres keeps the connections open until they time out — and
 * on Windows `node --watch` restarts fast enough to leak a pool per save, which eventually
 * hits max_connections and produces a "too many clients" error that looks like a code bug.
 */
async function shutdown(signal) {
  console.log(`[zenith] ${signal} received, shutting down`);
  clearInterval(reminderInterval);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
