import * as React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EmptyState({
  title = 'Nothing here yet',
  message,
  action,
  className,
}: {
  title?: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12 text-center', className)}>
      <div className="rounded-full bg-muted p-3">
        <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        {message ? <p className="mt-1 text-sm text-muted-foreground">{message}</p> : null}
      </div>
      {action ?? null}
    </div>
  );
}
