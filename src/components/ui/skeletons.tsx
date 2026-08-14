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
      <Skeleton className="h-8 w-full max-w-[16rem]" />
      <Skeleton className="h-4 w-full max-w-[20rem]" />
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

/**
 * A grid of cards, as on the events list.
 *
 * Mirrors the real card: title, three meta rows against icons, a status pill
 * in the corner, and a divided footer of actions — so the layout does not jump
 * when the data lands.
 */
export function CardGridSkeleton({
  cards = 6,
  label = 'Loading',
}: {
  cards?: number;
  label?: string;
}) {
  return (
    <Status label={label}>
      <div className="grid gap-6 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            className="rounded-[1.75rem] border border-border bg-card p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-3/4" />
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
            </div>
            <div className="mt-6 flex gap-3 border-t border-border pt-4">
              <Skeleton className="h-9 flex-1 rounded-lg" />
              <Skeleton className="h-9 flex-1 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </Status>
  );
}

/**
 * A detail page: back link, header block, a row of facts, then panels. Used
 * where a whole page is waiting rather than one list inside it.
 */
export function DetailSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <Status label={label}>
      <div className="space-y-8">
        <Skeleton className="h-4 w-32" />
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-full max-w-[24rem]" />
          <Skeleton className="h-4 w-full max-w-[18rem]" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="space-y-2 rounded-[1.5rem] border border-border bg-card p-5"
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-32" />
            </div>
          ))}
        </div>
        <div className="space-y-3 rounded-[1.5rem] border border-border bg-card p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    </Status>
  );
}

/**
 * A month grid, for the Suspense fallback on the calendar pages — where the
 * component that computes the real dates has not loaded yet, so unlike
 * MonthGrid's own loading state there is nothing real to show.
 */
export function CalendarSkeleton({ label = 'Loading calendar' }: { label?: string }) {
  return (
    <Status label={label}>
      <div className="rounded-[1.5rem] border border-border bg-card p-3 sm:p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-6 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-10 w-16 rounded-lg" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={`h-${i}`} className="mx-auto h-3 w-8" />
          ))}
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="min-h-16 rounded-lg sm:min-h-32" />
          ))}
        </div>
      </div>
    </Status>
  );
}

/**
 * The single centred card the password pages are built from. Sized to the real
 * card so the page does not resize under the reader mid-load.
 */
export function AuthCardSkeleton({ label = 'Loading' }: { label?: string }) {
  return (
    <Status label={label}>
      <div className="w-full max-w-md space-y-5 rounded-[1.75rem] border border-[#d3deef] bg-white p-6 sm:p-8">
        <Skeleton className="mx-auto h-12 w-12 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="mx-auto h-6 w-48" />
          <Skeleton className="mx-auto h-4 w-64" />
        </div>
        <div className="space-y-4 pt-2">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>
    </Status>
  );
}

/** A form: a heading and a run of labelled fields, then the actions. */
export function FormSkeleton({
  fields = 6,
  label = 'Loading',
}: {
  fields?: number;
  label?: string;
}) {
  return (
    <Status label={label}>
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-full max-w-[20rem]" />
        </div>
        <div className="space-y-5 rounded-[1.5rem] border border-border bg-card p-6">
          {Array.from({ length: fields }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <Skeleton className="h-10 w-28 rounded-xl" />
            <Skeleton className="h-10 w-24 rounded-xl" />
          </div>
        </div>
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
