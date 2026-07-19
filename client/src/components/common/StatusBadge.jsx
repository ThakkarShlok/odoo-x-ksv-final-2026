import { STATUS_CONFIG, cn } from '@/lib/utils';

export function StatusBadge({ status, className }) {
  const config = STATUS_CONFIG[status] || { label: status, color: 'bg-slate-100 text-slate-600' };
  const isUrgent = ['IN_RENTAL', 'RETURNED', 'OVERDUE', 'DAMAGED'].includes(status);
  
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', config.color, isUrgent && 'animate-pulse shadow-sm', className)}>
      {config.label}
    </span>
  );
}
