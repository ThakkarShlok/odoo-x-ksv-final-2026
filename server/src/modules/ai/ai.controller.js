import { prisma } from '../../config/prisma.js';
import { ok, fail } from '../../lib/apiResponse.js';
import { logActivity } from '../../lib/activityLog.js';

// In-memory maintenance tickets store
export const maintenanceTickets = new Map();

export async function evaluateMaintenance(req, res) {
  const assets = await prisma.productUnit.findMany({
    where: {
      status: { in: ['AVAILABLE', 'DAMAGED'] },
    },
  });

  let flaggedMaintenance = 0;

  for (const asset of assets) {
    // AI wear limit rule: flag if status is DAMAGED or condition is POOR
    const needsMaintenance = asset.status === 'DAMAGED' || asset.condition === 'POOR' || asset.condition === 'DAMAGED';

    if (needsMaintenance) {
      // Check if ticket already exists
      let alreadyExists = false;
      for (const ticket of maintenanceTickets.values()) {
        if (ticket.assetId === asset.id && ticket.status === 'PENDING') {
          alreadyExists = true;
          break;
        }
      }

      if (!alreadyExists) {
        const id = crypto.randomUUID ? crypto.randomUUID() : `maint-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + 2); // schedule for 2 days from now

        maintenanceTickets.set(id, {
          id,
          assetId: asset.id,
          issueDescription: `AI Predictive Flag: wear limit threshold reached. Unit status is ${asset.status}, condition is ${asset.condition}.`,
          status: 'PENDING',
          triggerSource: 'AI_PREDICTIVE',
          scheduledDate,
          notes: null,
          cost: '0.00',
          resolvedAt: null,
        });

        // Set asset status to MAINTENANCE in DB
        await prisma.productUnit.update({
          where: { id: asset.id },
          data: { status: 'MAINTENANCE' },
        });

        flaggedMaintenance++;
      }
    }
  }

  logActivity({
    userId: req.user.id,
    action: 'ai.maintenance_evaluate',
    entityType: 'ProductUnit',
    entityId: null,
    metadata: { flagged: flaggedMaintenance },
  });

  return ok(res, {
    data: {
      assetsAnalyzed: assets.length,
      flaggedMaintenance,
    },
  });
}

export async function listMaintenanceTickets(req, res) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));

  const tickets = Array.from(maintenanceTickets.values());
  const totalCount = tickets.length;
  const start = (page - 1) * limit;
  const paginated = tickets.slice(start, start + limit);

  const totalPages = Math.ceil(totalCount / limit);

  return ok(res, {
    data: paginated,
    meta: {
      totalCount,
      page,
      limit,
      totalPages,
    },
  });
}

export async function resolveMaintenanceTicket(req, res) {
  const { id } = req.params;
  const { notes, cost } = req.body;

  const ticket = maintenanceTickets.get(id);
  if (!ticket) {
    return fail(res, { status: 404, message: 'Maintenance ticket not found.' });
  }

  if (ticket.status !== 'PENDING') {
    return fail(res, { status: 400, message: 'Ticket is already resolved.' });
  }

  // Update in-memory ticket
  ticket.status = 'RESOLVED';
  ticket.notes = notes;
  ticket.cost = cost.toString();
  ticket.resolvedAt = new Date();

  // Restore physical asset status to AVAILABLE and condition to GOOD
  await prisma.productUnit.update({
    where: { id: ticket.assetId },
    data: { status: 'AVAILABLE', condition: 'GOOD', notes: `Maintenance resolved: ${notes}` },
  });

  logActivity({
    userId: req.user.id,
    action: 'ai.maintenance_resolve',
    entityType: 'ProductUnit',
    entityId: ticket.assetId,
    metadata: { cost: cost.toString() },
  });

  return ok(res, { message: 'Maintenance ticket resolved. Asset status updated to AVAILABLE.' });
}
