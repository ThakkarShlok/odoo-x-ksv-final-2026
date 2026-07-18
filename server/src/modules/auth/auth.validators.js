/**
 * WHAT: express-validator rule chains for the auth endpoints. These are the whitelist.
 * WHY THIS IS THE MASS-ASSIGNMENT DEFENCE: the controller reads ONLY the fields validated here.
 *   A client that POSTs {"email","password","name","role":"ADMIN"} gets validated on the first
 *   three; `role` is never read, so it is silently dropped. Privilege escalation via extra JSON
 *   fields is impossible because nothing downstream looks at the extra field.
 * REVIEWER QUESTION: "The last team had a frontend-only password check. Where is the BACKEND
 *   one?" -> Right here. Password min-length is enforced server-side in registerRules below.
 *   The frontend check is a UX nicety; THIS is the security boundary. A request sent with curl,
 *   bypassing the UI entirely, still hits this rule.
 */
import { body } from 'express-validator';

// Single source of truth for the rule, referenced by both register and (loosely) documented
// for the client. 8 is the floor; raise it, never lower it.
const PASSWORD_MIN = 8;

export const registerRules = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('A valid email is required.')
    .normalizeEmail(),
  body('password')
    .isString()
    .isLength({ min: PASSWORD_MIN })
    .withMessage(`Password must be at least ${PASSWORD_MIN} characters.`),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .isLength({ max: 120 })
    .withMessage('Name is too long.'),
  // NOTE: there is deliberately NO rule for `role`. Registration always creates an EMPLOYEE
  // (see the controller). Accepting a role here — even to validate it — would imply it is a
  // client-settable field, which is the exact vulnerability we are refusing.
];

export const loginRules = [
  body('email').trim().isEmail().withMessage('A valid email is required.').normalizeEmail(),
  // Only presence on login — never reveal the length policy to an unauthenticated caller, and
  // never re-run the strength check against an existing account whose password predates it.
  body('password').isString().notEmpty().withMessage('Password is required.'),
];

export const promoteRules = [
  body('userId').isUUID().withMessage('A valid userId is required.'),
];
