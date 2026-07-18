/**
 * WHAT: Translates database-level failures into HTTP status codes.
 * WHY THIS OVER THE ALTERNATIVE: the tempting alternative is a read-then-write check
 *   ("SELECT to see if it conflicts, then INSERT"). That is a race: two concurrent requests
 *   both read "no conflict" and both insert. The correct design is to let Postgres enforce the
 *   invariant with a constraint — which is atomic and cannot be raced — and translate the
 *   resulting violation into a clean 409 here. The database is the arbiter, not the app.
 * REVIEWER QUESTION: "Two users book the same resource at the same instant. What happens?"
 *   -> One INSERT wins. The other violates the EXCLUDE constraint, Postgres raises SQLSTATE
 *      23P01, and this maps it to 409 Conflict. No lost update, no application-level lock.
 *
 * SQLSTATE reference for the codes we care about:
 *   23505 unique_violation
 *   23P01 exclusion_violation   <- the no-overlap rule (see migration 002)
 *   23503 foreign_key_violation
 */
import { AppError } from './apiResponse.js';

/** Digs the raw Postgres SQLSTATE out of a Prisma error, wherever Prisma stashed it. */
function pgCode(err) {
  // Raw-query failures (P2010) carry the driver error under meta.code.
  if (err?.meta?.code) return String(err.meta.code);
  // PrismaClientUnknownRequestError surfaces it only inside the message text.
  const match = /\b(23\d{3}|23P01)\b/.exec(err?.message ?? '');
  return match ? match[1] : null;
}

/**
 * Returns an AppError if this is a database error we understand, else null
 * (null => the error middleware treats it as an unexpected 500).
 */
export function mapPrismaError(err) {
  const code = pgCode(err);

  if (code === '23P01' || err?.code === 'P2034') {
    return new AppError(
      'That time range conflicts with an existing reservation for this resource.',
      409
    );
  }

  if (code === '23505' || err?.code === 'P2002') {
    // err.meta.target names the offending column(s) — safe to surface, it is our own schema.
    const target = err?.meta?.target;
    const field = Array.isArray(target) ? target.join(', ') : target;
    return new AppError(
      field ? `A record with this ${field} already exists.` : 'That record already exists.',
      409
    );
  }

  if (code === '23503' || err?.code === 'P2003') {
    return new AppError('Referenced record does not exist.', 422);
  }

  if (err?.code === 'P2025') {
    return new AppError('Record not found.', 404);
  }

  return null;
}
