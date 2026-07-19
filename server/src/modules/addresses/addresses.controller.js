import { prisma } from '../../config/prisma.js';
import { ok, fail } from '../../lib/apiResponse.js';

export async function listAddresses(req, res) {
  const addresses = await prisma.address.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });

  return ok(res, {
    data: addresses.map((a) => ({
      id: a.id,
      type: a.type,
      label: a.label,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      state: a.state,
      postalCode: a.postalCode,
      country: a.country,
      isDefault: a.isDefault,
    })),
  });
}

export async function createAddress(req, res) {
  const { type, label, line1, line2, city, state, postalCode, country, isDefault } = req.body;

  // If setting as default, unset existing defaults for this user + type
  if (isDefault) {
    await prisma.address.updateMany({
      where: { userId: req.user.id, type, isDefault: true },
      data: { isDefault: false },
    });
  }

  const address = await prisma.address.create({
    data: {
      userId: req.user.id,
      type: type || 'SHIPPING',
      label,
      line1,
      line2,
      city,
      state,
      postalCode,
      country: country || 'India',
      isDefault: isDefault || false,
    },
  });

  return ok(res, { status: 201, data: address });
}

export async function updateAddress(req, res) {
  const { id } = req.params;
  const { type, label, line1, line2, city, state, postalCode, country, isDefault } = req.body;

  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing || existing.userId !== req.user.id) {
    return fail(res, { status: 404, message: 'Address not found.' });
  }

  if (isDefault) {
    await prisma.address.updateMany({
      where: { userId: req.user.id, type: type || existing.type, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.address.update({
    where: { id },
    data: { type, label, line1, line2, city, state, postalCode, country, isDefault },
  });

  return ok(res, { data: updated });
}

export async function deleteAddress(req, res) {
  const { id } = req.params;

  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing || existing.userId !== req.user.id) {
    return fail(res, { status: 404, message: 'Address not found.' });
  }

  try {
    await prisma.address.delete({ where: { id } });
  } catch (err) {
    if (err.code === 'P2003') {
      return fail(res, { status: 409, message: 'Cannot delete address referenced by an order.' });
    }
    throw err;
  }

  return ok(res, { message: 'Address deleted.' });
}
