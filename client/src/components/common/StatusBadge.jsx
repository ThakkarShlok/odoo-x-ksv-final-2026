import { cn } from '@/lib/utils';

// Colour map covers the boilerplate statuses AND the rental order lifecycle. Only four semantic
// status token pairs exist (active/inactive/warning/danger); lifecycle states map onto them by
// meaning: draft=warning, live=active(green), terminal=slate, cancelled=danger.
const STATUS_STYLES = {
  ACTIVE: 'bg-status-active-bg text-status-active',
  INACTIVE: 'bg-status-inactive-bg text-status-inactive',
  PENDING: 'bg-status-warning-bg text-status-warning',
  ARCHIVED: 'bg-status-inactive-bg text-status-inactive',
  // Rental order statuses
  QUOTATION: 'bg-status-warning-bg text-status-warning',
  CONFIRMED: 'bg-status-active-bg text-status-active',
  PICKED_UP: 'bg-status-active-bg text-status-active',
  IN_RENTAL: 'bg-status-active-bg text-status-active',
  RETURNED: 'bg-status-inactive-bg text-status-inactive',
  CLOSED: 'bg-status-inactive-bg text-status-inactive',
  CANCELLED: 'bg-status-danger-bg text-status-danger',
};

const FALLBACK = 'bg-muted text-muted-foreground';

// Multi-word enum values (IN_RENTAL) render as "In Rental"; single words (ACTIVE) stay as-is so
// they read naturally AND keep the existing StatusBadge test stable.
function humanize(s) {
  if (!s.includes('_')) return s;
  return s
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function StatusBadge({ status, className }) {
  const style = (status && STATUS_STYLES[status]) ?? FALLBACK;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        style,
        className
      )}
    >
      {status ? humanize(status) : 'UNKNOWN'}
    </span>
  );
}
