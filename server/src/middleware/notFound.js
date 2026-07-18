/**
 * WHAT: Terminal 404 for any /api path that matched no route.
 * WHY THIS OVER THE ALTERNATIVE: without it, Express 5 sends its default HTML 404 page. A
 *   client that always parses JSON then dies on "<!DOCTYPE" instead of reporting the real
 *   problem, which is a genuinely annoying 20 minutes to debug at 3am.
 * REVIEWER QUESTION: "Does a typo'd endpoint return the same envelope as everything else?" -> Yes.
 */
import { fail } from '../lib/apiResponse.js';

export function notFound(req, res) {
  return fail(res, { status: 404, message: `Route not found: ${req.method} ${req.originalUrl}` });
}
