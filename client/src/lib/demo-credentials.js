/**
 * WHAT: The demo credentials shown on the landing page and pre-fillable on login.
 * WHY A SHARED CONSTANT: these MUST match server/prisma/seed.js exactly, or the "log in
 *   instantly" flow — the first thing a judge touches — fails on the first try. Defining them in
 *   one frontend module (instead of hardcoding into JSX twice) means the landing display and the
 *   login quick-fill can never disagree with each other. They still must be kept in sync with
 *   the seed by hand; that cross-file link is called out in a comment in seed.js too.
 *
 * These are intentionally public, weak, committed demo logins. They are NOT secrets — nothing
 * they reach is real. See the note in seed.js.
 */
export const DEMO_CREDENTIALS = [
  { role: 'ADMIN', label: 'Administrator', email: 'admin@zenith.dev', password: 'admin12345' },
  { role: 'EMPLOYEE', label: 'Employee', email: 'employee@zenith.dev', password: 'employee12345' },
];
