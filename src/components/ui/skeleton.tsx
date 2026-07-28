import { cn } from '@/lib/utils/cn';

/**
 * shadcn's Skeleton, written by hand because this project has no
 * components.json for the CLI to read — same shape as `shadcn add skeleton`,
 * but using the app's own `bg-muted` token rather than a hardcoded slate so it
 * follows the theme.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // aria-hidden: a screen reader should hear the page's loading message,
      // not a run of empty boxes.
      aria-hidden
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
