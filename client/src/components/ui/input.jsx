/** shadcn/ui Input. Source, not a dependency. aria-invalid styling wired for form errors. */
import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        // When react-hook-form marks a field invalid, the red ring is automatic.
        'aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive',
        className
      )}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
