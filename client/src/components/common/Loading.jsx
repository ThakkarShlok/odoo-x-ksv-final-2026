/** Loading state. One component so every spinner in the app looks identical. */
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Loading({ label = 'Loading…', className }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-10 text-muted-foreground', className)}>
      {/* aria-hidden on the icon; the text carries the meaning for screen readers. */}
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span role="status">{label}</span>
    </div>
  );
}
