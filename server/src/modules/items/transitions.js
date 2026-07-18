/**
 * WHAT: The legal state-transition graph for Item.status, as data.
 * WHY A CONFIG TABLE AND NOT if/else IN THE CONTROLLER: encoding "which status can become which"
 *   as a plain object means the rules are a single, reviewable, testable artifact. Adding a
 *   PENDING or ARCHIVED state tomorrow is one edit here, not a hunt through branching logic in a
 *   handler. The guard reads the graph; it contains no rules itself.
 * WHY ENUM-BACKED, NEVER FREE STRINGS: the keys below are exactly the Prisma ItemStatus enum
 *   values. Postgres already rejects any status outside the enum at write time; this layer adds
 *   the orthogonal rule of which enum-to-enum MOVES are allowed. Type-validity and
 *   transition-validity are different questions and both are enforced.
 * REVIEWER QUESTION: "Can an item jump from any status to any other?"
 *   -> No. Illegal transitions are rejected with 422 before any write. The allowed set is
 *      declared below and nowhere else.
 */
import { AppError } from '../../lib/apiResponse.js';

// Adjacency list: FROM status -> array of statuses it may move TO.
// A status mapping to [] is terminal. Self-transitions (ACTIVE->ACTIVE) are intentionally NOT
// listed, so a no-op update is caught as illegal rather than silently succeeding — surface it.
export const ITEM_TRANSITIONS = {
  ACTIVE: ['INACTIVE'],
  INACTIVE: ['ACTIVE'],
};

/**
 * Pure predicate. No I/O, trivially unit-testable.
 * @returns {boolean} whether `from -> to` is a declared legal transition.
 */
export function canTransition(from, to) {
  const allowed = ITEM_TRANSITIONS[from];
  if (!allowed) return false; // unknown source status => nothing is legal from it
  return allowed.includes(to);
}

/**
 * Guard used by the controller. Throws a 422 AppError on an illegal move so the central error
 * handler produces the standard envelope; returns void on success.
 */
export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    // A real AppError instance, because the error handler routes on `instanceof AppError`.
    // A look-alike plain object with name:'AppError' would fail that check and be treated as
    // an unexpected 500 — the exact bug this throws to avoid.
    const message =
      `Illegal status transition: ${from} -> ${to}. ` +
      `Allowed from ${from}: ${(ITEM_TRANSITIONS[from] ?? []).join(', ') || '(none)'}.`;
    throw new AppError(message, 422);
  }
}
