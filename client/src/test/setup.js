/**
 * Vitest setup, loaded before every test file (wired via `test.setupFiles` in vite.config.js).
 *
 * Registers jest-dom's custom matchers — toBeInTheDocument(), toBeDisabled(), toHaveClass().
 * Without this import those matchers do not exist and assertions fail with a confusing
 * "is not a function" rather than a real assertion error.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Unmount everything between tests. Testing Library queries search the whole document, so a
// leaked component from a previous test makes getByRole find two matches and fail — a failure
// that points at the wrong test and is genuinely nasty to track down.
afterEach(() => {
  cleanup();
});
