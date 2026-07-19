import { prisma } from '../../config/prisma.js';
import { ok, fail } from '../../lib/apiResponse.js';
import { logActivity } from '../../lib/activityLog.js';

export async function getSettings(req, res) {
  const settings = await prisma.rentalSettings.findFirst({
    where: { isActive: true },
  });

  if (!settings) {
    return ok(res, {
      data: {
        id: null,
        depositRuleType: 'PERCENTAGE',
        depositValue: '20.00',
        gracePeriodHours: 0,
        lateFeeRuleType: 'PER_DAY_FLAT',
        lateFeeValue: '500.00',
        maxLateFeeCap: '5000.00',
        currency: 'INR',
      },
    });
  }

  return ok(res, {
    data: {
      id: settings.id,
      name: settings.name,
      depositRuleType: settings.depositRuleType,
      depositValue: settings.depositValue.toString(),
      gracePeriodHours: settings.gracePeriodHours,
      lateFeeRuleType: settings.lateFeeRuleType,
      lateFeeValue: settings.lateFeeValue.toString(),
      maxLateFeeCap: settings.maxLateFeeCap.toString(),
      currency: settings.currency,
    },
  });
}

export async function updateSettings(req, res) {
  const {
    depositRuleType, depositValue,
    gracePeriodHours,
    lateFeeRuleType, lateFeeValue, maxLateFeeCap,
  } = req.body;

  let settings = await prisma.rentalSettings.findFirst({
    where: { isActive: true },
  });

  const data = {
    depositRuleType,
    depositValue: parseFloat(depositValue),
    gracePeriodHours: parseInt(gracePeriodHours, 10),
    lateFeeRuleType,
    lateFeeValue: parseFloat(lateFeeValue),
    maxLateFeeCap: parseFloat(maxLateFeeCap),
  };

  if (settings) {
    settings = await prisma.rentalSettings.update({
      where: { id: settings.id },
      data,
    });
  } else {
    settings = await prisma.rentalSettings.create({
      data: { ...data, isActive: true },
    });
  }

  logActivity({
    userId: req.user.id,
    action: 'settings.update',
    entityType: 'RentalSettings',
    entityId: settings.id,
  });

  return ok(res, {
    data: {
      id: settings.id,
      name: settings.name,
      depositRuleType: settings.depositRuleType,
      depositValue: settings.depositValue.toString(),
      gracePeriodHours: settings.gracePeriodHours,
      lateFeeRuleType: settings.lateFeeRuleType,
      lateFeeValue: settings.lateFeeValue.toString(),
      maxLateFeeCap: settings.maxLateFeeCap.toString(),
      currency: settings.currency,
    },
  });
}
