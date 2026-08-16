'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Clock,
  User,
  Search,
  X,
  ClipboardList,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { apiFetch, messageFor } from '@/lib/api/client';
import { useCurrentUser } from '@/components/SessionProvider';
import { ListSkeleton } from '@/components/ui/skeletons';
import type { MinutesListResponse, MinutesSummary } from '@/lib/types/events';
import { PageContainer } from '@/components/ui/page-container';

const STATUS_FILTERS = [
  { value: '', label: 'Current' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'PUBLISHED', label: 'Published' },
];

/** Only leadership may read archived records, so only they get the filter. */
const ARCHIVE_READER_ROLES = ['MINISTER', 'SUPER_ADMIN'];

function StatusBadge({ status }: { status: MinutesSummary['status'] }) {
  const styles: Record<string, string> = {
    PUBLISHED: 'border-stat-green-border bg-stat-green-bg text-success',
    DRAFT: 'border-stat-blue-border bg-stat-blue-bg text-primary',
    ARCHIVED: 'border-border bg-muted text-muted-foreground',
  };
  const labels: Record<string, string> = {
    PUBLISHED: 'Published',
    DRAFT: 'Draft',
    ARCHIVED: 'Archived',
  };

  return (
    <span
      className={`inline-block shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${styles[status] ?? styles.DRAFT}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function dateOf(value: string) {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export default function MinutesPage() {
  const currentUser = useCurrentUser();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const canReadArchived = ARCHIVE_READER_ROLES.includes(
    currentUser?.systemRole ?? '',
  );
  const filters = canReadArchived
    ? [...STATUS_FILTERS, { value: 'ARCHIVED', label: 'Archived' }]
    : STATUS_FILTERS;

  // The list was capped at the server's default of 25 with no way to ask for
  // more and nothing on screen saying so — it printed "312 records" above the
  // 25 it could show. At 100+ meetings a week, a minute from three weeks ago
  // was unreachable by browsing.
  const [take, setTake] = useState(25);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['minutes-list', q, status, take],
    queryFn: () => {
      const p = new URLSearchParams();
      if (q.trim()) p.set('q', q.trim());
      if (status) p.set('status', status);
      p.set('take', String(take));
      return apiFetch<MinutesListResponse>(`/api/v1/minutes?${p.toString()}`);
    },
  });

  const minutes = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <PageContainer>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-success">
          Records
        </p>
        <h1 className="text-3xl font-bold text-primary">Meeting minutes</h1>
        <p className="mt-2 text-muted-foreground">
          Every meeting written up so far. Meetings with no minutes yet are on
          the events page.
        </p>
      </div>

      {/* Two rows rather than one wrapping row. Sharing a line, the search box
          and the status pills fought for the same width and each one squeezed
          at a different point — the pills losing their labels on one handset,
          the search box collapsing to a stub on the next. Stacked, each gets
          the full width and the layout is the same on every phone. */}
      <div className="space-y-3 rounded-[1.5rem] border border-border bg-card p-4 sm:p-5">
        <div className="relative">
          <label htmlFor="minutes-search" className="sr-only">
            Search minutes
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="minutes-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by meeting or content…"
            className="w-full rounded-xl border border-border bg-muted/40 py-2.5 pl-9 pr-9 text-sm text-foreground placeholder-muted-foreground focus:border-primary"
          />
          {q && (
            <button
              onClick={() => setQ('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Wraps rather than scrolls. There are at most four filters, and
            dividing the row evenly clips "Published" below about 360px while a
            horizontal scroll would hide "Archived" behind an affordance nobody
            looks for. Two short rows on a small handset costs nothing. */}
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                status === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <p>{messageFor(error, "We couldn't load the minutes.")}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-destructive/10"
          >
            Try again
          </button>
        </div>
      )}

      {isLoading ? (
        <ListSkeleton rows={5} label="Loading minutes" />
      ) : minutes.length === 0 ? (
        <div className="rounded-[1.5rem] border border-border bg-card p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">
            {q.trim()
              ? `No minutes match “${q.trim()}”`
              : status
                ? 'Nothing here under that status'
                : 'No minutes yet'}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {q.trim() || status
              ? 'Try fewer words, or clear the search.'
              : 'Minutes are written up on the meeting itself. Open an event and choose Minutes to start a record.'}
          </p>
          <Link
            href="/administrative/events"
            className="mt-5 inline-flex items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Go to events <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {minutes.length < total
              ? `Showing the ${minutes.length} most recent of ${total} — search to narrow it down.`
              : `${total} ${total === 1 ? 'record' : 'records'}`}
          </p>

          <div className="overflow-hidden rounded-[1.5rem] border border-border bg-card">
            <ul className="divide-y divide-border">
              {minutes.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/administrative/events/${m.event.id}/minutes`}
                    className="flex flex-wrap items-start justify-between gap-4 p-5 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex min-w-0 items-start gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                        <FileText className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold text-primary">
                          {m.event.title}
                        </h2>
                        {/* What the meeting settled, in its own words. The
                            summary line this replaced was a separate thing
                            somebody had to remember to write. */}
                        {m.points.length > 0 && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {m.points.map((p) => p.text).join(' · ')}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {dateOf(m.event.startAt)}
                          </span>
                          {(m.publishedBy ?? m.draftedBy) && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {m.publishedBy
                                ? `Published by ${m.publishedBy.name}`
                                : `Drafted by ${m.draftedBy?.name}`}
                            </span>
                          )}
                          {m._count.points > 0 && (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {m._count.points}{' '}
                              {m._count.points === 1 ? 'point' : 'points'}
                            </span>
                          )}
                          {m._count.actionItems > 0 && (
                            <span className="flex items-center gap-1">
                              <ClipboardList className="h-3 w-3" />
                              {m._count.actionItems}{' '}
                              {m._count.actionItems === 1
                                ? 'action item'
                                : 'action items'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <StatusBadge status={m.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {minutes.length < total && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setTake((n) => n + 25)}
                className="rounded-[1.25rem] border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              >
                Load older minutes
              </button>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
