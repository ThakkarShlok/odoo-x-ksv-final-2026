import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-status-active-bg text-status-active',
  INACTIVE: 'bg-status-inactive-bg text-status-inactive',
  PENDING: 'bg-status-warning-bg text-status-warning',
  ARCHIVED: 'bg-status-inactive-bg text-status-inactive',
};

const FALLBACK = 'bg-muted text-muted-foreground';

export function StatusBadge({ status, className }: { status?: string; className?: string }) {
  const style = (status && STATUS_STYLES[status]) ?? FALLBACK;
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
