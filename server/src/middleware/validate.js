/**
 * WHAT: The bridge between express-validator's rule chains and our error envelope.
 *   Collects any validation failures a route's validators recorded and returns a 422 with a
 *   field-keyed errors array, before the controller runs.
 * WHY THIS OVER THE ALTERNATIVE: checking validationResult(req) by hand at the top of every
 *   controller is four boilerplate lines that are easy to forget — and a forgotten check means
 *   unvalidated input reaches the database. One middleware, mounted after the rule chain, makes
 *   validation impossible to skip: if it is not in the chain, the route is not validated, and
 *   that is visible in the route file.
 * REVIEWER QUESTION: "Where is mass-assignment prevented?"
 *   -> The validators (auth.validators.js, items.validators.js) whitelist exactly the allowed
 *      fields, and the controllers read only those named fields — never req.body wholesale. A
 *      client cannot set `role` or `createdById` by adding them to the JSON, because nothing
 *      reads them. This middleware is what makes that whitelist enforceable.
 * 422, not 400: the request was well-formed JSON (a 400-class syntax problem) but semantically
 * invalid. 422 Unprocessable Entity is the precise code and the frontend keys off it.
 */
import { validationResult } from 'express-validator';
import { fail } from '../lib/apiResponse.js';

export function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  // Shape the errors as [{ field, message }] — the exact contract the axios helper
  // getFieldErrors() and the react-hook-form mapping on the client both expect.
  const errors = result.array().map((e) => ({
    field: e.path ?? e.param ?? 'unknown',
    message: e.msg,
  }));

  return fail(res, { status: 422, message: 'Validation failed.', errors });
}
