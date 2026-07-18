/**
 * WHAT: Thin wrapper around jsonwebtoken so signing/verifying live in one place.
 * WHY THIS OVER THE ALTERNATIVE: scattering jwt.sign/jwt.verify across controllers means the
 *   secret, the expiry, and the payload shape are re-specified at each call site and drift
 *   apart. One module = one definition of "what a Zenith token is".
 * REVIEWER QUESTION: "What is in your token and how long is it valid?"
 *   -> Payload is exactly { id, email, role }; expiry is 7 days. Nothing else — a token is an
 *      identity claim, not a data store. Never put a password hash or PII in a JWT: the payload
 *      is base64, not encrypted, and anyone holding the token can read it.
 */
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const EXPIRES_IN = '7d';

export function signToken({ id, email, role }) {
  // Only these three claims. `role` is copied from the DB at sign time; see the note in
  // auth.js about why the middleware still trusts it rather than re-reading the DB.
  return jwt.sign({ id, email, role }, env.jwtSecret, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token) {
  // Throws on expired/tampered/wrong-secret tokens. The caller (authMiddleware) turns the
  // throw into a 401 — we never want a malformed token to reach a route handler.
  return jwt.verify(token, env.jwtSecret);
}
