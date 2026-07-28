'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Plus,
  CalendarDays,
  MapPin,
  Users,
  ArrowUpDown,
  Radio,
  History,
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api/client';
import {
  EVENT_TYPE_LABELS,
  EVENT_STATUS_LABELS,
  type EventListItem,
  type EventListResponse,
  type EventStatus,
} from '@/lib/types/events';

/** Status pill colours: cancelled must read as inactive, not as a draft. */
const STATUS_PILL: Record<EventStatus, string> = {
  PUBLISHED: 'bg-[#edf8f1] text-ring',
  DRAFT: 'bg-[#edf3fd] text-primary',
  CANCELLED: 'bg-muted text-muted-foreground line-through',
};

const SORT_OPTIONS = [
  { value: 'startAt:asc', label: 'Date (soonest first)' },
  { value: 'startAt:desc', label: 'Date (latest first)' },
  { value: 'title:asc', label: 'Title (A–Z)' },
  { value: 'title:desc', label: 'Title (Z–A)' },
  { value: 'status:asc', label: 'Status' },
] as const;

// Three timeframes, shown one at a time as tabs rather than stacked down the
// page — all three at once meant scrolling past whatever was empty to reach
// whatever was not.
const TABS = [
  {
    timeframe: 'now',
    title: 'Happening now',
    icon: Radio,
    empty: 'Nothing is running right now.',
  },
  {
    timeframe: 'upcoming',
    title: 'Upcoming',
    icon: CalendarDays,
    empty: 'No upcoming events.',
  },
  {
    timeframe: 'past',
    title: 'Past',
    icon: History,
    empty: 'No past events.',
  },
] as const;

type Timeframe = (typeof TABS)[number]['timeframe'];

function formatDateTime(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const date = start.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const time = `${start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  return { date, time };
}

function EventCard({ event }: { event: EventListItem }) {
  const { date, time } = formatDateTime(event.startAt, event.endAt);

  return (
    <div className="group rounded-[1.75rem] border border-border bg-card p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)] transition-all hover:border-primary/30 hover:shadow-[0_16px_40px_rgba(0,53,128,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-primary">{event.title}</h3>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              {date} &middot; {time}
            </div>
            {(event.venueName || event.room) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {event.room?.name ?? event.venueName}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {event._count.attendees} attendees &middot; {EVENT_TYPE_LABELS[event.type]}
            </div>
          </div>
        </div>
        <span
          className={`inline-block shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
            STATUS_PILL[event.status] ?? STATUS_PILL.DRAFT
          }`}
        >
          {EVENT_STATUS_LABELS[event.status] ?? event.status}
        </span>
      </div>

      <div className="mt-6 flex gap-3 border-t border-border pt-4">
        <Link
          href={`/administrative/events/${event.id}/edit`}
          className="flex-1 rounded-lg bg-secondary px-3 py-2 text-center text-sm font-medium text-secondary-foreground transition-colors hover:bg-muted"
        >
          Edit
        </Link>
        <Link
          href={`/administrative/events/${event.id}`}
          className="flex-1 rounded-lg bg-muted px-3 py-2 text-center text-sm font-medium text-foreground transition-colors hover:bg-border"
        >
          View
        </Link>
      </div>
    </div>
  );
}

/**
 * One timeframe's worth of events.
 *
 * Kept as a hook rather than living inside the panel so all three run whatever
 * tab is open — that is what lets each tab carry its own count, so an empty
 * "Happening now" is visible without clicking into it. It is the same three
 * requests the stacked layout already made, so nothing got more expensive.
 */
function useEventsQuery(
  timeframe: Timeframe,
  isPublicFilter: 'all' | 'internal' | 'public',
  sort: string,
) {
  return useQuery({
    queryKey: ['events', timeframe, isPublicFilter, sort],
    queryFn: () => {
      const [sortBy, order] = sort.split(':');
      const params = new URLSearchParams({ timeframe, sortBy, order });
      if (isPublicFilter !== 'all') {
        params.set('isPublic', String(isPublicFilter === 'public'));
      }
      return apiFetch<EventListResponse>(`/api/v1/events?${params.toString()}`);
    },
  });
}

function EventPanel({
  query,
  empty,
}: {
  query: ReturnType<typeof useEventsQuery>;
  empty: string;
}) {
  const { data, isLoading, error } = query;

  return (
    <div>
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load events'}
        </div>
      )}

      {isLoading && (
        <div className="rounded-[1.75rem] border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      )}

      {!isLoading && data && data.data.length === 0 && (
        <p className="rounded-[1.75rem] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      )}

      {!isLoading && data && data.data.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          {data.data.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

export function EventsList() {
  const [isPublicFilter, setIsPublicFilter] = useState<'all' | 'internal' | 'public'>(
    'all',
  );
  const [sort, setSort] = useState<string>('startAt:asc');
  // Upcoming rather than the first tab: "Happening now" is empty most of the
  // day, and opening the page onto an empty panel hides the thing people came
  // for.
  const [active, setActive] = useState<Timeframe>('upcoming');

  // Called unconditionally and in a fixed order — see useEventsQuery.
  const queries: Record<Timeframe, ReturnType<typeof useEventsQuery>> = {
    now: useEventsQuery('now', isPublicFilter, sort),
    upcoming: useEventsQuery('upcoming', isPublicFilter, sort),
    past: useEventsQuery('past', isPublicFilter, sort),
  };

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Events</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your ministry&apos;s meetings and public events
          </p>
        </div>
        <Link
          href="/administrative/events/new"
          className="flex items-center gap-2 rounded-[1.25rem] bg-primary px-6 py-3 font-medium text-primary-foreground shadow-[0_8px_16px_rgba(0,53,128,0.24)] transition-all hover:shadow-[0_12px_24px_rgba(0,53,128,0.32)]"
        >
          <Plus className="h-5 w-5" />
          Create Event
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {(['all', 'internal', 'public'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setIsPublicFilter(filter)}
              className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition-colors ${
                isPublicFilter === filter
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-muted'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowUpDown className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <div
          role="tablist"
          aria-label="Event timeframe"
          className="flex flex-wrap gap-1 border-b border-border"
        >
          {TABS.map(({ timeframe, title, icon: Icon }) => {
            const isActive = active === timeframe;
            const count = queries[timeframe].data?.total;
            return (
              <button
                key={timeframe}
                role="tab"
                type="button"
                id={`events-tab-${timeframe}`}
                aria-selected={isActive}
                aria-controls={`events-panel-${timeframe}`}
                onClick={() => setActive(timeframe)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {title}
                {count !== undefined && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      isActive
                        ? 'bg-secondary text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {TABS.filter((t) => t.timeframe === active).map((t) => (
          <div
            key={t.timeframe}
            role="tabpanel"
            id={`events-panel-${t.timeframe}`}
            aria-labelledby={`events-tab-${t.timeframe}`}
            className="pt-6"
          >
            <EventPanel query={queries[t.timeframe]} empty={t.empty} />
          </div>
        ))}
      </div>
    </div>
  );
}
