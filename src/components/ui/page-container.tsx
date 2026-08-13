import * as React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * The standard frame every admin page opens with.
 *
 * Compact mode keys off data-page-container rather than the padding utility.
 * Tailwind emits responsive variants as escaped selectors — `sm:p-6` compiles
 * to `.sm\:p-6` — which the plain `.p-8` rule in globals.css cannot match. Left
 * on the utilities, the responsive padding this adds would have silently
 * switched compact mode off for every page it touched.
 *
 * Not a client component: several callers are server components, and there is
 * nothing interactive here.
 */
export function PageContainer({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-page-container=""
      className={cn('w-full space-y-6 p-4 sm:p-6 lg:p-8', className)}
      {...props}
    />
  );
}
