'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { eventColor, toDayParam } from '@/lib/event-colors';
import type { EventType } from '@/lib/types/events';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_CHIPS = 3;

export interface CalendarEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  colorCategory?: string | null;
  type?: EventType | null;
  venueName?: string | null;
  room?: { name: string } | null;
}

/** First and last instant of a month as a half-open [from, to) pair. */
export function monthRange(year: number, month: number) {
  return {
    from: new Date(year, month, 1).toISOString(),
    to: new Date(year, month + 1, 1).toISOString(),
  };
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Month grid shared by the authenticated calendar and the public one — the grid
 * maths and cell layout are identical, so they live here once.
 *
 * `hrefForEvent` and `hrefForDay` let each caller route into its own detail and
 * day pages, and `navHref` builds the prev/today/next links.
 */
export function MonthGrid({
  year,
  month,
  events,
  isLoading,
  hrefForEvent,
  hrefForDay,
  navHref,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  isLoading?: boolean;
  hrefForEvent: (id: string) => string;
  hrefForDay: (dayParam: string) => string;
  navHref: (target: { year: number; month: number } | 'today') => string;
}) {
  const today = new Date();
  const start = new Date(year, month, 1);
  const firstWeekday = start.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const byDay = new Map<number, CalendarEvent[]>();
  for (const e of events) {
    const d = new Date(e.startAt);
    // Guard against a range boundary leaking an adjacent month into the grid.
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const key = d.getDate();
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthLabel = start.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const prev = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
  const next = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };

  return (
    <div className="rounded-[1.5rem] border border-border bg-card p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-foreground">{monthLabel}</h2>
        <div className="flex gap-2">
          <Link
            href={navHref(prev)}
            aria-label="Previous month"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link
            href={navHref('today')}
            className="rounded-lg border border-border bg-muted px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
          >
            Today
          </Link>
          <Link
            href={navHref(next)}
            aria-label="Next month"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {isLoading && (
        <p className="pb-4 text-sm text-muted-foreground">Loading events…</p>
      )}

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="p-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="sm:hidden">{w.slice(0, 1)}</span>
              <span className="hidden sm:inline">{w}</span>
            </p>
          </div>
        ))}

        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`pad-${i}`} className="min-h-32 rounded-lg" />;
          }

          const cellDate = new Date(year, month, day);
          const isToday = sameDay(cellDate, today);
          const dayEvents = byDay.get(day) ?? [];
          const chips = dayEvents.slice(0, MAX_CHIPS);
          const more = dayEvents.length - chips.length;
          const dayParam = toDayParam(cellDate);

          return (
            <div
              key={day}
              className={`min-h-32 rounded-lg border p-2 transition-colors ${
                isToday
                  ? 'border-primary/40 bg-primary/5'
                  : dayEvents.length > 0
                    ? 'border-border/80 bg-muted/30'
                    : 'border-border/30 hover:bg-muted/20'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <Link
                  href={hrefForDay(dayParam)}
                  className={`text-sm font-semibold transition-colors hover:text-primary ${
                    isToday ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {day}
                </Link>
                {dayEvents.length > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1 text-xs font-medium text-primary">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                {chips.map((e) => {
                  const time = new Date(e.startAt).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const place = e.room?.name ?? e.venueName;

                  return (
                    <Link
                      key={e.id}
                      href={hrefForEvent(e.id)}
                      title={e.title}
                      className={`block rounded border px-2 py-1.5 text-xs font-medium transition-shadow hover:shadow-sm ${eventColor(
                        e.colorCategory,
                        e.type,
                      )}`}
                    >
                      <span className="block truncate">{e.title}</span>
                      <span className="mt-0.5 flex items-center gap-1 truncate opacity-75">
                        <Clock className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">
                          {time}
                          {place ? ` · ${place}` : ''}
                        </span>
                      </span>
                    </Link>
                  );
                })}

                {more > 0 && (
                  <Link
                    href={hrefForDay(dayParam)}
                    className="block rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                  >
                    +{more} more
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
