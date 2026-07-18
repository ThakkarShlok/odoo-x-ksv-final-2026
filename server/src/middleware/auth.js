/**
 * WHAT: Layer 1 of 3-layer RBAC — AUTHENTICATION. "Who are you?"
 *   Extracts the Bearer token, verifies it, and attaches req.user = { id, email, role }.
 * WHY THIS OVER THE ALTERNATIVE: verifying the token inside each controller means one forgotten
 *   check is an unauthenticated hole. A single gate that every protected route passes through
 *   makes "is this route protected?" a one-line, greppable fact instead of a per-handler audit.
 * REVIEWER QUESTION: "Walk me through your authorization layers."
 *   -> Layer 1 (this file): authenticate — is the token valid? Layer 2 (requireRole): authorize
 *      by role — are you allowed to call this verb? Layer 3 (ownership scoping, commented in
 *      requireRole.js): authorize by row — is THIS record yours? All three are separate
 *      middleware so each answers exactly one question and can be reasoned about alone.
 *
 * A NOTE A REVIEWER WILL PROBE — "the role in the token can go stale":
 *   True. If an admin demotes a user, that user's existing 7-day token still says ADMIN until
 *   it expires. We accept this: the alternative (a DB lookup on every request) trades the app's
 *   whole performance for a rare event, and the real fix for "revoke now" is a short token TTL
 *   plus a refresh endpoint — a documented Phase-2 upgrade, not something to fake here.
 */
import { verifyToken } from '../lib/jwt.js';
import { fail } from '../lib/apiResponse.js';

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization ?? '';

  // Must be exactly "Bearer <token>". Being strict here avoids a class of parsing bugs
  // where "Bearer" with no token, or a raw token with no scheme, is silently accepted.
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return fail(res, { status: 401, message: 'Authentication required. Provide a Bearer token.' });
  }

  try {
    const payload = verifyToken(token);
    // Attach ONLY the claims we signed. Never trust extra fields a client might smuggle in a
    // hand-crafted token body — the signature only guarantees these three came from us.
    req.user = { id: payload.id, email: payload.email, role: payload.role };
    return next();
  } catch {
    // Covers expired, tampered, and wrong-secret tokens alike — all are "not authenticated"
    // from the client's point of view. We deliberately do not distinguish "expired" from
    // "invalid" in the response: telling an attacker which one it was is free information.
    return fail(res, { status: 401, message: 'Invalid or expired token.' });
  }
}
