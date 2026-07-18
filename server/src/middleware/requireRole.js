/**
 * WHAT: Layer 2 of 3-layer RBAC — AUTHORIZATION BY ROLE. "Are you allowed to do this?"
 *   requireRole('ADMIN') rejects anyone whose token role is not in the allowed set with 403.
 * WHY 401 vs 403 MATTERS: authMiddleware returns 401 ("I don't know who you are"); this returns
 *   403 ("I know who you are, and you may not"). Collapsing them into one status throws away the
 *   single most useful signal when debugging an access bug at 3am.
 * REVIEWER QUESTION: "How do you stop an EMPLOYEE from calling an admin-only endpoint?"
 *   -> Chain it after authMiddleware: router.post('/promote', authMiddleware,
 *      requireRole('ADMIN'), handler). The role comes from the verified token, so it cannot be
 *      spoofed by the client without forging our signature.
 *
 * MUST run AFTER authMiddleware — it reads req.user, which authMiddleware sets. Ordering the
 * chain the other way round would read undefined and crash; the guard below turns that
 * programming error into a clear 401 instead of a 500.
 */
import { fail } from '../lib/apiResponse.js';

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      // Defensive: this only fires if requireRole was mounted without authMiddleware before it.
      return fail(res, { status: 401, message: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return fail(res, {
        status: 403,
        message: `Forbidden. Requires role: ${allowedRoles.join(' or ')}.`,
      });
    }

    return next();
  };
}

/**
 * ============================================================================
 * LAYER 3 — AUTHORIZATION BY ROW (ownership scoping). "Is THIS record yours?"
 * ============================================================================
 * This is the IDOR (Insecure Direct Object Reference) defence, and it is the layer teams
 * forget. Layers 1 and 2 confirm you are a logged-in EMPLOYEE — but they do NOT stop you from
 * reading /api/items/<someone-else's-uuid>. Only a WHERE clause scoped to the caller does that.
 *
 * We ship it as a COMMENTED REFERENCE rather than wired in, because "who owns what" is a domain
 * decision that arrives with tomorrow's problem statement. The shape you copy:
 *
 *   // In a controller, AFTER authMiddleware + requireRole:
 *   const item = await prisma.item.findFirst({
 *     where: {
 *       id: req.params.id,
 *       // The scope. An ADMIN sees everything; everyone else sees only their own rows.
 *       // Omitting this line is the entire IDOR vulnerability class in one missing filter.
 *       ...(req.user.role === 'ADMIN' ? {} : { createdById: req.user.id }),
 *     },
 *   });
 *   if (!item) return fail(res, { status: 404, message: 'Not found.' });
 *   // 404, not 403: revealing "this exists but isn't yours" leaks which UUIDs are real.
 *
 * Why findFirst + a WHERE, and not findUnique(id) followed by an `if (item.createdById !== ...)`
 * check: the WHERE pushes the ownership rule into the database query itself, so a forgotten
 * post-fetch `if` cannot leak the row. The rule lives where the data lives.
 *
 * A ready-to-use factory for the common case:
 */
export function ownershipScope(req, ownerField = 'createdById') {
  // Spread this into any Prisma `where`. ADMIN => no restriction; otherwise => own rows only.
  return req.user.role === 'ADMIN' ? {} : { [ownerField]: req.user.id };
}
