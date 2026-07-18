import { body } from 'express-validator';

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
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required.')
    .isLength({ max: 120 })
    .withMessage('Full name is too long.'),
  body('phoneNumber')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required.'),
  body('address')
    .trim()
    .notEmpty()
    .withMessage('Address is required.'),
];

export const loginRules = [
  body('email').trim().isEmail().withMessage('A valid email is required.').normalizeEmail(),
  body('password').isString().notEmpty().withMessage('Password is required.'),
];

export const promoteRules = [
  body('userId').isUUID().withMessage('A valid userId is required.'),
];
