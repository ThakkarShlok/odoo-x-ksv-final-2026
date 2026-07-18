/**
 * Real seeded credentials (server/prisma/seed.js). Displayed on the landing page and one-click
 * fillable on login. Public, weak, committed — demo logins, not secrets. The retired
 * employee@zenith.dev account is gone; these are the rental-domain ADMIN + CUSTOMER accounts.
 */
export const DEMO_CREDENTIALS = [
  { role: 'ADMIN', label: 'Administrator', email: 'admin@zenith.dev', password: 'admin12345' },
  { role: 'CUSTOMER', label: 'Customer (Alice)', email: 'alice@zenith.dev', password: 'customer12345' },
  { role: 'CUSTOMER', label: 'Customer (Bob)', email: 'bob@zenith.dev', password: 'customer12345' },
];
