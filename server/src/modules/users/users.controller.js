import { prisma } from '../../config/prisma.js';
import { ok, fail, AppError } from '../../lib/apiResponse.js';
import { logActivity } from '../../lib/activityLog.js';

function toPublicProfile(user) {
  const defaultAddress = user.addresses?.find(a => a.isDefault)?.line1 || user.addresses?.[0]?.line1 || '';
  return {
    id: user.id,
    email: user.email,
    fullName: user.name,
    phoneNumber: user.phone || '',
    address: defaultAddress,
    role: user.role,
    profileImageUrl: null, // Placeholder as not in schema
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getProfile(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { addresses: true },
  });
  if (!user) {
    return fail(res, { status: 404, message: 'Profile not found.' });
  }
  return ok(res, { data: { user: toPublicProfile(user) } });
}

export async function updateProfile(req, res) {
  const { fullName, phoneNumber, address } = req.body;

  const updatedUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: req.user.id },
      data: {
        name: fullName,
        phone: phoneNumber,
      },
      include: { addresses: true },
    });

    if (address) {
      const defaultAddress = user.addresses.find(a => a.isDefault);
      if (defaultAddress) {
        await tx.address.update({
          where: { id: defaultAddress.id },
          data: { line1: address },
        });
      } else {
        await tx.address.create({
          data: {
            userId: user.id,
            type: 'SHIPPING',
            label: 'Default Address',
            line1: address,
            city: 'Default',
            postalCode: '000000',
            isDefault: true,
          },
        });
      }
    }

    return tx.user.findUnique({
      where: { id: req.user.id },
      include: { addresses: true },
    });
  });

  logActivity({
    userId: req.user.id,
    action: 'user.update_profile',
    entityType: 'User',
    entityId: req.user.id,
  });

  return ok(res, { data: { user: toPublicProfile(updatedUser) } });
}

export async function listUsers(req, res) {
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));
  const role = req.query.role;
  const search = req.query.search;

  const where = {};
  if (role) {
    where.role = role;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { addresses: true },
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return ok(res, {
    data: users.map(toPublicProfile),
    meta: {
      totalCount,
      page,
      limit,
      totalPages,
    },
  });
}

export async function updateUserRole(req, res) {
  const { id } = req.params;
  const { role } = req.body;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return fail(res, { status: 404, message: 'User not found.' });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role },
  });

  logActivity({
    userId: req.user.id,
    action: 'user.promote',
    entityType: 'User',
    entityId: id,
    metadata: { newRole: role },
  });

  return ok(res, {
    data: {
      user: {
        id: updated.id,
        email: updated.email,
        fullName: updated.name,
        role: updated.role,
        updatedAt: updated.updatedAt,
      },
    },
  });
}

export async function deleteUser(req, res) {
  const { id } = req.params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return fail(res, { status: 404, message: 'User not found.' });
  }

  // Schema doesn't have deletedAt, so we do physical delete
  await prisma.user.delete({ where: { id } });

  logActivity({
    userId: req.user.id,
    action: 'user.delete',
    entityType: 'User',
    entityId: id,
  });

  return ok(res, { message: 'User deleted successfully.' });
}
