import { prisma } from '../../config/prisma.js';
import { ok, fail } from '../../lib/apiResponse.js';
import { logActivity } from '../../lib/activityLog.js';

export async function submitInspection(req, res) {
  const {
    orderId,
    assetId,
    physicalCondition,
    accessoriesComplete,
    damageLogged,
    damageNotes,
    damagePhotoUrl,
  } = req.body;

  const order = await prisma.rentalOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return fail(res, { status: 404, message: 'Order not found.' });
  }

  // Find the physical unit
  const unit = await prisma.productUnit.findUnique({
    where: { id: assetId },
  });

  if (!unit) {
    return fail(res, { status: 404, message: 'Asset not found.' });
  }

  if (damageLogged && !damageNotes) {
    return fail(res, { status: 400, message: 'Missing notes for damages.' });
  }

  await prisma.$transaction(async (tx) => {
    // Find or update the RETURN event in RentalEvent
    const existingReturnEvent = await tx.rentalEvent.findFirst({
      where: { orderId, eventType: 'RETURN' },
    });

    if (existingReturnEvent) {
      await tx.rentalEvent.update({
        where: { id: existingReturnEvent.id },
        data: {
          actualAt: new Date(),
          conditionNotes: damageNotes || `Physical condition: ${physicalCondition}`,
          damageFlag: damageLogged,
          inspectedById: req.user.id,
        },
      });
    } else {
      await tx.rentalEvent.create({
        data: {
          orderId,
          eventType: 'RETURN',
          scheduledAt: order.rentalEnd,
          actualAt: new Date(),
          conditionNotes: damageNotes || `Physical condition: ${physicalCondition}`,
          damageFlag: damageLogged,
          inspectedById: req.user.id,
        },
      });
    }

    // Divert asset status to DAMAGED if structural damages logged
    if (damageLogged) {
      await tx.productUnit.update({
        where: { id: assetId },
        data: {
          status: 'DAMAGED',
          condition: physicalCondition === 'DAMAGED' ? 'DAMAGED' : 'POOR',
          notes: damageNotes,
        },
      });
    } else {
      await tx.productUnit.update({
        where: { id: assetId },
        data: {
          status: 'AVAILABLE',
          condition: physicalCondition === 'FLAWLESS' ? 'NEW' : 'GOOD',
        },
      });
    }
  });

  logActivity({
    userId: req.user.id,
    action: 'inspection.submit',
    entityType: 'RentalEvent',
    entityId: orderId,
    metadata: { damageLogged },
  });

  return ok(res, {
    status: 201,
    data: {
      id: `ins_${orderId.slice(0, 8)}`,
      orderId,
      assetId,
      inspectorId: req.user.id,
      physicalCondition,
      accessoriesComplete,
      damageLogged,
      damageNotes: damageNotes || null,
      damagePhotoUrl: damagePhotoUrl || null,
      submittedAt: new Date(),
    },
  });
}

export async function getUploadSignature(req, res) {
  const { folder } = req.body;

  // Cloudinary Signed Upload Credentials Mock (per specification)
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = '8a3d4f5c9e2b103e' + crypto.randomUUID?.().slice(0, 16) || '8a3d4f5c9e2b103e';

  return ok(res, {
    data: {
      signature,
      timestamp,
      apiKey: '123456789012345',
      cloudName: 'odoo-rental-cloud',
    },
  });
}
