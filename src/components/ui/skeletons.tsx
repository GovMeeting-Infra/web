import { Skeleton } from './skeleton';

/**
 * Shared loading shapes.
 *
 * Kept in one place so every page waits the same way, and so a skeleton
 * actually resembles the content that replaces it — a placeholder of the wrong
 * shape makes the page jump when data arrives, which is worse than a spinner.
 *
 * Each wrapper carries role="status" and a visually hidden label, so assistive
 * technology hears "Loading…" rather than nothing while the boxes pulse.
 */
function Status({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Eyebrow, title and subtitle, matching the standard page header. */
export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-80" />
    </div>
  );
}

/** A row of stat cards, as on the dashboard and profile. */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Status label="Loading figures">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-[1.5rem] border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>
    </Status>
  );
}

/** A bordered card containing a list of rows — the commonest shape here. */
export function ListSkeleton({
  rows = 5,
  label = 'Loading',
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <Status label={label}>
      <div className="overflow-hidden rounded-[1.5rem] border border-border bg-card">
        <ul className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, i) => (
            <li key={i} className="flex items-center justify-between gap-4 p-5">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
            </li>
          ))}
        </ul>
      </div>
    </Status>
  );
}

/**
 * Bare rows, for lists that already sit inside a bordered card — the dashboard
 * panels, where ListSkeleton's own border would draw a second frame.
 */
export function RowsSkeleton({
  rows = 4,
  label = 'Loading',
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <Status label={label}>
      <ul className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="flex items-center justify-between gap-4 px-6 py-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="h-3 w-16 shrink-0" />
          </li>
        ))}
      </ul>
    </Status>
  );
}

/** A table, for the activity log and other column-based views. */
export function TableSkeleton({
  rows = 8,
  columns = 5,
  label = 'Loading',
}: {
  rows?: number;
  columns?: number;
  label?: string;
}) {
  return (
    <Status label={label}>
      <div className="overflow-hidden rounded-[1.5rem] border border-border bg-card">
        <div className="flex gap-4 border-b border-border bg-muted/40 px-4 py-3">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex gap-4 px-4 py-4">
              {Array.from({ length: columns }).map((_, c) => (
                <Skeleton
                  key={c}
                  className="h-4 flex-1"
                  // Slight variation stops the block reading as a solid grid.
                  style={{ maxWidth: c === 0 ? '9rem' : undefined }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </Status>
  );
}

/** A single content card, for detail panels. */
export function CardSkeleton({
  lines = 3,
  label = 'Loading',
}: {
  lines?: number;
  label?: string;
}) {
  return (
    <Status label={label}>
      <div className="space-y-3 rounded-[1.5rem] border border-border bg-card p-6">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-4"
            style={{ width: i === lines - 1 ? '60%' : '100%' }}
          />
        ))}
      </div>
    </Status>
  );
}
