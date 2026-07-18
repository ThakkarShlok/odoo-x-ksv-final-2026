/**
 * Error state with an optional retry. Every failed fetch renders this, so "something broke"
 * looks the same everywhere and always offers the same way out (retry) when one exists.
 */
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ErrorState({ title = 'Something went wrong', message, onRetry, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-10 text-center', className)}>
      <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        {message ? <p className="mt-1 text-sm text-muted-foreground">{message}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
