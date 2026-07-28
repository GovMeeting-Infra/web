'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';
import { PublicShell } from '@/components/PublicShell';
import { apiFetch } from '@/lib/api/client';
import { eventColor, eventCategoryLabel, toDayParam } from '@/lib/event-colors';
import type { PublicEventListItem } from '@/lib/types/events';

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

export function PublicDayView() {
  const params = useSearchParams();
  const selected = parseDayParam(params.get('d'));

  const startOfDay = new Date(
    selected.getFullYear(),
    selected.getMonth(),
    selected.getDate(),
  );
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-day', toDayParam(selected)],
    queryFn: () =>
      apiFetch<PublicEventListItem[]>(
        `/api/v1/public/events?${new URLSearchParams({
          from: startOfDay.toISOString(),
          to: endOfDay.toISOString(),
        }).toString()}`,
      ),
  });

  const events = data ?? [];

  const shift = (days: number) => {
    const d = new Date(startOfDay);
    d.setDate(d.getDate() + days);
    return `/public-calendar/day?d=${toDayParam(d)}`;
  };

  return (
    <PublicShell>
      <div className="space-y-6">
        <Link
          href={`/?y=${selected.getFullYear()}&m=${selected.getMonth()}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#003580]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Calendar
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#003580] sm:text-3xl">
              {selected.toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {events.length} {events.length === 1 ? 'activity' : 'activities'}
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href={shift(-1)}
              aria-label="Previous day"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d3deef] bg-white text-slate-600 hover:bg-[#edf4fd]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            <Link
              href="/public-calendar/day"
              className="rounded-lg border border-[#d3deef] bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-[#edf4fd]"
            >
              Today
            </Link>
            <Link
              href={shift(1)}
              aria-label="Next day"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d3deef] bg-white text-slate-600 hover:bg-[#edf4fd]"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : 'Failed to load activities'}
          </div>
        )}

        {isLoading && (
          <p className="rounded-2xl border border-[#d3deef] bg-white p-10 text-center text-sm text-slate-500">
            Loading activities…
          </p>
        )}

        {!isLoading && events.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[#d3deef] p-10 text-center text-sm text-slate-500">
            No public activities scheduled for this day.
          </p>
        )}

        {!isLoading && events.length > 0 && (
          <ol className="space-y-3">
            {events.map((event) => {
              const start = new Date(event.startAt);
              const end = new Date(event.endAt);
              const timeOpts = { hour: '2-digit', minute: '2-digit' } as const;

              return (
                <li key={event.id}>
                  <Link
                    href={`/public-calendar/event/${event.id}`}
                    className="flex gap-4 rounded-2xl border border-[#d3deef] bg-white p-6 transition-shadow hover:shadow-[0_12px_32px_rgba(0,53,128,0.08)]"
                  >
                    <div className="w-20 shrink-0 border-r border-[#d3deef] pr-4 text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {start.toLocaleTimeString(undefined, timeOpts)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {end.toLocaleTimeString(undefined, timeOpts)}
                      </p>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-[#003580]">{event.title}</h2>
                        <span
                          className={`rounded border px-2 py-0.5 text-xs font-medium ${eventColor(
                            event.colorCategory,
                            event.type,
                          )}`}
                        >
                          {eventCategoryLabel(event.colorCategory, event.type)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          {start.toLocaleTimeString(undefined, timeOpts)} –{' '}
                          {end.toLocaleTimeString(undefined, timeOpts)}
                        </span>
                        {event.venueName && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" />
                            {event.venueName}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </PublicShell>
  );
}
