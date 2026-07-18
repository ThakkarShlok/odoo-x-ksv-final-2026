/**
 * WHAT: The one response envelope every endpoint uses.
 *   success -> { success: true,  message, data, meta }
 *   failure -> { success: false, message, errors }
 * WHY THIS OVER THE ALTERNATIVE: returning bare arrays/objects means the client writes a
 *   different unwrapping branch per endpoint, and adding pagination later is a breaking change
 *   on every consumer. A fixed envelope means the frontend has exactly one `res.data.data`
 *   access path and `meta` absorbs pagination/counts without touching the contract.
 * REVIEWER QUESTION: "How does the frontend distinguish a validation failure from a crash?"
 *   -> `success` is always present; `errors` is a field-keyed array only on 4xx validation.
 * This file is the runtime half of docs/api-contract.md. Change both together.
 */

/** 2xx. `meta` carries pagination/counts without ever changing the response shape. */
export function ok(res, { status = 200, message = 'OK', data = null, meta = undefined } = {}) {
  return res.status(status).json({ success: true, message, data, meta });
}

/** 4xx/5xx. `errors` is an array of { field, message } — never a raw exception. */
export function fail(res, { status = 400, message = 'Request failed', errors = undefined } = {}) {
  return res.status(status).json({ success: false, message, errors });
}

/**
 * An error we deliberately raised and whose message is safe to show a user.
 * The error middleware trusts `AppError.message` and nothing else — an unexpected
 * exception never has its message forwarded to the client.
 */
export class AppError extends Error {
  constructor(message, status = 400, errors = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.errors = errors;
    this.isOperational = true;
  }
}
