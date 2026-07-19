/**
 * WHAT: Loads .env and validates required configuration at process start.
 * WHY THIS OVER THE ALTERNATIVE: the common pattern is `process.env.JWT_SECRET` read at the
 *   point of use. That fails at 2am, on one request, as a 500 with a useless stack — or worse,
 *   `jwt.sign(payload, undefined)` throws while `jwt.verify` misbehaves subtly. Failing here
 *   means a missing variable is a boot-time crash with the variable's name in the message,
 *   which is the cheapest possible bug to diagnose.
 * REVIEWER QUESTION: "What happens if someone clones this and forgets JWT_SECRET?"
 *   -> The server refuses to start and tells them exactly which variable is missing.
 */
import 'dotenv/config';

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'];

const missing = REQUIRED.filter((key) => !process.env[key] || process.env[key].trim() === '');

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variable(s): ${missing.join(', ')}.\n` +
      `Fix: copy server/.env.example to server/.env and fill in real values.\n` +
      `  PowerShell:  Copy-Item server\\.env.example server\\.env`
  );
}

// Refuse the placeholder. A shipped "replace-me" secret is the same as no secret,
// but it fails silently instead of loudly — so we make it fail loudly.
if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET === 'replace-me') {
  throw new Error('JWT_SECRET is still the placeholder value "replace-me". Generate a real secret.');
}

export const env = {
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  razorpayKeyId: process.env.RAZORPAY_KEY_ID?.trim() || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET?.trim() || '',
  port: Number(process.env.PORT ?? 5000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900_000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 500),
  isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'Zenith Rentals <noreply@zenith.dev>',
};
