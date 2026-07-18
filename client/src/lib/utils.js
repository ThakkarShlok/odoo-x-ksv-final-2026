import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * WHAT: Merges Tailwind class strings, letting later classes win conflicts.
 * WHY BOTH clsx AND twMerge: clsx handles conditionals ({ 'x': isActive }) but produces
 *   "px-2 px-4" for conflicting classes — where the winner is decided by CSS source order,
 *   not by argument order, so a component's prop override silently loses. twMerge resolves
 *   that to "px-4". This is shadcn/ui's standard helper; every generated component imports it.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
