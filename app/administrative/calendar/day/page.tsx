'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  CalendarDays,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { eventColor, eventCategoryLabel, toDayParam } from '@/lib/event-colors';
import { PageContainer } from '@/components/ui/page-container';
import {
  EVENT_STATUS_LABELS,
  type EventListResponse,
  type EventListItem,
} from '@/lib/types/events';

/** Parses ?d=YYYY-MM-DD as a local date; falls back to today when absent. */
function parseDayParam(value: string | null): Date {
  if (value) {
    const [y, m, d] = value.split('-').map(Number);
    if (y && m && d) {
      const parsed = new Date(y, m - 1, d);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

export default function CalendarDayPage() {
  const params = useSearchParams();
  const view = params.get('view') === 'public' ? 'public' : 'internal';
  const selected = parseDayParam(params.get('d'));

  const startOfDay = new Date(
    selected.getFullYear(),
    selected.getMonth(),
    selected.getDate(),
  );
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const { data, isLoading, error } = useQuery({
    queryKey: ['calendar-day', toDayParam(selected), view],
    queryFn: () => {
      const qs = new URLSearchParams({
        from: startOfDay.toISOString(),
        to: endOfDay.toISOString(),
        sortBy: 'startAt',
        order: 'asc',
        isPublic: String(view === 'public'),
      });
      return apiFetch<EventListResponse>(`/api/v1/events?${qs.toString()}`);
    },
  });

  const events = data?.data ?? [];

  const shift = (days: number) => {
    const d = new Date(startOfDay);
    d.setDate(d.getDate() + days);
    return `/administrative/calendar/day?d=${toDayParam(d)}&view=${view}`;
  };

  const heading = selected.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <PageContainer>
      <Link
        href={`/administrative/calendar?y=${selected.getFullYear()}&m=${selected.getMonth()}&view=${view}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Calendar
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-ring">
            {view === 'public' ? 'Public agenda' : 'Internal agenda'}
          </p>
          <h1 className="text-3xl font-bold text-primary">{heading}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {events.length} {events.length === 1 ? 'event' : 'events'} scheduled
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={shift(-1)}
            aria-label="Previous day"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link
            href={`/administrative/calendar/day?view=${view}`}
            className="rounded-lg border border-border bg-muted px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
          >
            Today
          </Link>
          <Link
            href={shift(1)}
            aria-label="Next day"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load the agenda'}
        </div>
      )}

      {isLoading && (
        <div className="rounded-[1.5rem] border border-border bg-card p-12 text-center text-muted-foreground">
          Loading agenda…
        </div>
      )}

      {!isLoading && events.length === 0 && (
        <div className="rounded-[1.5rem] border border-dashed border-border p-12 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Nothing scheduled for this day.</p>
        </div>
      )}

      {!isLoading && events.length > 0 && (
        <ol className="space-y-3">
          {events.map((event: EventListItem) => {
            const start = new Date(event.startAt);
            const end = new Date(event.endAt);
            const timeOpts = { hour: '2-digit', minute: '2-digit' } as const;

            return (
              <li key={event.id}>
                <Link
                  href={`/administrative/events/${event.id}`}
                  className="flex gap-4 rounded-[1.5rem] border border-border bg-card p-6 transition-all hover:border-primary/30 hover:shadow-[0_12px_32px_rgba(0,53,128,0.08)]"
                >
                  {/* Time rail */}
                  <div className="w-20 shrink-0 border-r border-border pr-4 text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {start.toLocaleTimeString(undefined, timeOpts)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {end.toLocaleTimeString(undefined, timeOpts)}
                    </p>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-primary">{event.title}</h2>
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-medium ${eventColor(
                          event.colorCategory,
                          event.type,
                        )}`}
                      >
                        {eventCategoryLabel(event.colorCategory, event.type)}
                      </span>
                      {event.status !== 'PUBLISHED' && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {EVENT_STATUS_LABELS[event.status] ?? event.status}
                        </span>
                      )}
                    </div>

                    {event.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {event.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {start.toLocaleTimeString(undefined, timeOpts)} –{' '}
                        {end.toLocaleTimeString(undefined, timeOpts)}
                      </span>
                      {(event.room || event.venueName) && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-4 w-4" />
                          {event.room?.name ?? event.venueName}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        {event._count.attendees} invited
                      </span>
                      {event.organizer && <span>· {event.organizer.name}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </PageContainer>
  );
}
