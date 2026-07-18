/**
 * WHAT: Auth handlers — register, login, me, promote.
 * SECURITY INVARIANTS enforced here (each answers a reviewer question):
 *   1. Passwords are bcrypt-hashed at cost 10, never stored or logged in plaintext.
 *   2. `role` is assigned SERVER-SIDE. register() always creates EMPLOYEE. Elevation happens
 *      only through promote(), which is gated to ADMIN. Roles are never self-selected.
 *   3. passwordHash is stripped from EVERY response via toPublicUser() — one function, so the
 *      hash cannot leak by someone forgetting to omit it on a new endpoint.
 *   4. Login returns an identical error for "no such email" and "wrong password" — user
 *      enumeration defence: an attacker must not learn which emails are registered.
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma.js';
import { signToken } from '../../lib/jwt.js';
import { ok, fail, AppError } from '../../lib/apiResponse.js';
import { logActivity } from '../../lib/activityLog.js';

// Cost 10: ~50-100ms/hash on commodity hardware. High enough that offline cracking is
// expensive, low enough that login stays snappy. MUST match the seed's hash cost, or seeded
// users and registered users would be hashed inconsistently.
const BCRYPT_ROUNDS = 10;

/** The ONLY shape a User ever leaves the server in. Note the absence of passwordHash. */
function toPublicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** POST /api/auth/register — always creates an EMPLOYEE. */
export async function register(req, res) {
  // Read named fields only. Anything else in req.body (e.g. a smuggled `role`) is ignored.
  const { email, password, name } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // On REGISTER we do reveal the email is taken — the user needs to know to log in instead,
    // and a signup form leaks this anyway. (Login, by contrast, must NOT leak it.)
    return fail(res, { status: 409, message: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      // Hardcoded. Not from req.body. This one line is the anti-privilege-escalation guarantee.
      role: 'EMPLOYEE',
    },
  });

  // Non-blocking audit. No actor id yet beyond the new user themselves.
  logActivity({
    userId: user.id,
    action: 'auth.register',
    entityType: 'User',
    entityId: user.id,
    metadata: { email: user.email },
  });

  const token = signToken(user);
  return ok(res, {
    status: 201,
    message: 'Account created.',
    data: { token, user: toPublicUser(user) },
  });
}

/** POST /api/auth/login */
export async function login(req, res) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });

  // CRITICAL: the SAME response whether the email is unknown or the password is wrong.
  // We still run bcrypt.compare against a dummy hash when the user is missing so the response
  // TIME does not betray which case it was (a timing side-channel is user enumeration too).
  const hashToCheck = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinva';
  const passwordOk = await bcrypt.compare(password, hashToCheck);

  if (!user || !passwordOk) {
    return fail(res, { status: 401, message: 'Invalid email or password.' });
  }

  const token = signToken(user);
  return ok(res, {
    message: 'Signed in.',
    data: { token, user: toPublicUser(user) },
  });
}

/** GET /api/auth/me — returns the caller's own profile from the verified token. */
export async function me(req, res) {
  // req.user is set by authMiddleware. We re-read from the DB so a freshly-promoted user sees
  // their new role here even though their token is stale (see the note in middleware/auth.js).
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) return fail(res, { status: 404, message: 'User not found.' });
  return ok(res, { message: 'Current user.', data: { user: toPublicUser(user) } });
}

/** POST /api/auth/promote — ADMIN-only (enforced by requireRole in the route). */
export async function promote(req, res) {
  const { userId } = req.body;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new AppError('Target user not found.', 404);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: 'ADMIN' },
  });

  logActivity({
    userId: req.user.id, // the admin who performed the promotion — the actor, not the target
    action: 'auth.promote',
    entityType: 'User',
    entityId: userId,
    metadata: { promotedBy: req.user.id, newRole: 'ADMIN' },
  });

  return ok(res, { message: 'User promoted to ADMIN.', data: { user: toPublicUser(updated) } });
}
