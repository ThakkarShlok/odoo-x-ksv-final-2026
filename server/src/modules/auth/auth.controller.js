import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { ok, fail } from '../../lib/apiResponse.js';
import { logActivity } from '../../lib/activityLog.js';
import { mailService } from '../notifications/mail.service.js';

const BCRYPT_ROUNDS = 10;

// In-memory store for refresh sessions to avoid db schema changes
// token -> { userId, expiresAt }
export const refreshTokens = new Map();

function toPublicUser(user, address = '') {
  return {
    id: user.id,
    fullName: user.name,
    email: user.email,
    phoneNumber: user.phone,
    address: address,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function parseCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const parts = cookie.split('=');
    const key = parts[0]?.trim();
    const value = parts.slice(1).join('=')?.trim();
    if (key) acc[key] = value;
    return acc;
  }, {});
  return cookies[name];
}

function setRefreshTokenCookie(res, token, maxAgeSeconds = 7 * 24 * 60 * 60) {
  const secure = env.isProduction ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `refreshToken=${token || ''}; HttpOnly; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Strict${secure}`
  );
}

export async function register(req, res) {
  const { fullName, email, password, phoneNumber, address } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return fail(res, { status: 409, message: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Run in transaction to create both User and default Address
  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email,
        name: fullName,
        phone: phoneNumber,
        passwordHash,
        role: 'CUSTOMER',
      },
    });

    await tx.address.create({
      data: {
        userId: createdUser.id,
        type: 'SHIPPING',
        label: 'Default Address',
        line1: address,
        city: 'Default',
        postalCode: '000000',
        isDefault: true,
      },
    });

    return createdUser;
  });

  logActivity({
    userId: user.id,
    action: 'auth.register',
    entityType: 'User',
    entityId: user.id,
    metadata: { email: user.email },
  });

  // Send welcome email asynchronously
  mailService.sendWelcomeEmail(user).catch((err) => {
    console.error('[auth.register] Failed to send welcome email:', err);
  });

  return ok(res, {
    status: 201,
    message: 'Account created.',
    data: { user: toPublicUser(user, address) },
  });
}

export async function login(req, res) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { addresses: { where: { isDefault: true } } },
  });

  const hashToCheck = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinva';
  const passwordOk = await bcrypt.compare(password, hashToCheck);

  if (!user || !passwordOk) {
    return fail(res, { status: 401, message: 'Invalid email or password.' });
  }

  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: '15m' }
  );

  const refreshToken = crypto.randomUUID();
  refreshTokens.set(refreshToken, {
    userId: user.id,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  setRefreshTokenCookie(res, refreshToken);

  const defaultAddress = user.addresses?.[0]?.line1 || '';

  return ok(res, {
    message: 'Signed in.',
    data: {
      accessToken,
      user: {
        id: user.id,
        fullName: user.name,
        email: user.email,
        role: user.role,
        phoneNumber: user.phone,
        address: defaultAddress,
      },
    },
  });
}

export async function refresh(req, res) {
  const token = parseCookie(req, 'refreshToken');

  if (!token) {
    return fail(res, { status: 401, message: 'Refresh token required.' });
  }

  const session = refreshTokens.get(token);
  if (!session || session.expiresAt < Date.now()) {
    refreshTokens.delete(token);
    return fail(res, { status: 401, message: 'Invalid or expired refresh token.' });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    refreshTokens.delete(token);
    return fail(res, { status: 401, message: 'User not found.' });
  }

  // Rotate tokens
  refreshTokens.delete(token);

  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: '15m' }
  );

  const newRefreshToken = crypto.randomUUID();
  refreshTokens.set(newRefreshToken, {
    userId: user.id,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  setRefreshTokenCookie(res, newRefreshToken);

  return ok(res, {
    message: 'Token refreshed.',
    data: { accessToken },
  });
}

export async function logout(req, res) {
  const token = parseCookie(req, 'refreshToken');
  if (token) {
    refreshTokens.delete(token);
  }

  setRefreshTokenCookie(res, null, 0);

  return ok(res, { message: 'Logout successful.' });
}

export async function me(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { addresses: { where: { isDefault: true } } },
  });
  if (!user) return fail(res, { status: 404, message: 'User not found.' });

  const defaultAddress = user.addresses?.[0]?.line1 || '';
  return ok(res, {
    message: 'Current user.',
    data: { user: toPublicUser(user, defaultAddress) },
  });
}

export async function promote(req, res) {
  const { userId } = req.body;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return fail(res, { status: 404, message: 'Target user not found.' });

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: 'ADMIN' },
  });

  logActivity({
    userId: req.user.id,
    action: 'auth.promote',
    entityType: 'User',
    entityId: userId,
    metadata: { promotedBy: req.user.id, newRole: 'ADMIN' },
  });

  return ok(res, { message: 'User promoted to ADMIN.', data: { user: toPublicUser(updated) } });
}
