/**
 * WHAT: Maps a status enum value to a coloured pill, using the status tokens from tokens.css.
 * WHY A LOOKUP MAP AND NOT INLINE COLOURS: a component that writes bg-green-100 at each call
 *   site can't be re-themed and drifts (one ACTIVE badge green, another teal). One map = one
 *   definition, and adding tomorrow's PENDING/ARCHIVED status is a single new entry here.
 * This is the component the Vitest test exercises — it is pure, deterministic, and has clear
 * branches, which makes it the honest choice for "one small component test."
 */
import { cn } from '@/lib/utils';

// Keyed by the exact ItemStatus enum values from the Prisma schema. The `unknown` fallback means
// a status we have not styled yet renders as neutral rather than crashing — defensive against
// tomorrow's enum growing before this map catches up.
const STATUS_STYLES = {
  ACTIVE: 'bg-status-active-bg text-status-active',
  INACTIVE: 'bg-status-inactive-bg text-status-inactive',
  // Reserved for tomorrow — harmless if unused, ready if needed:
  PENDING: 'bg-status-warning-bg text-status-warning',
  ARCHIVED: 'bg-status-inactive-bg text-status-inactive',
};

const FALLBACK = 'bg-muted text-muted-foreground';

export function StatusBadge({ status, className }) {
  const style = STATUS_STYLES[status] ?? FALLBACK;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        style,
        className
      )}
    >
      {status ?? 'UNKNOWN'}
    </span>
  );
}
