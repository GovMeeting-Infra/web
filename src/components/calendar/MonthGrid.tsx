'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { eventColor, toDayParam } from '@/lib/event-colors';
import { Skeleton } from '@/components/ui/skeleton';
import type { EventType } from '@/lib/types/events';
import { Tooltip } from '@/components/ui/tooltip';

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
  /** Who is running it. Only the public calendar sets this. */
  ministryName?: string | null;
}

/** First and last instant of a month as a half-open [from, to) pair. */
/**
 * Both calendars read the year straight off a query string, and both only
 * checked its lower bound. `?y=99999999` produced a date outside the range
 * toISOString can represent, which threw a RangeError — on the public calendar
 * that is the state homepage, and there is no error boundary above it. Clamped
 * here rather than at the two call sites so a third caller cannot reintroduce
 * it.
 */
export function monthRange(year: number, month: number) {
  const safeYear = Math.min(2200, Math.max(1970, year));
  return {
    from: new Date(safeYear, month, 1).toISOString(),
    to: new Date(safeYear, month + 1, 1).toISOString(),
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

  // Days that actually have something on them, in order, for the phone agenda.
  const agenda = Array.from(byDay.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, dayEvents]) => ({
      date: new Date(year, month, day).toISOString(),
      events: [...dayEvents].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      ),
    }));

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
    // p-3 below sm: seven columns leave about 31px a cell at 320px, and the
    // three event dots come to 22px inside a cell that has its own border and
    // padding — so they touched the edge. This buys back ~3.4px a cell.
    <div className="rounded-[1.5rem] border border-border bg-card p-3 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-foreground">{monthLabel}</h2>
        <div className="flex gap-2">
          <Tooltip content="The month before this one">
            <Link
              href={navHref(prev)}
              aria-label="Previous month"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Tooltip>
          <Tooltip content="Jump back to the current month">
            <Link
              href={navHref('today')}
              className="flex h-10 items-center rounded-lg border border-border bg-muted px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
            >
              Today
            </Link>
          </Tooltip>
          <Tooltip content="The month after this one">
            <Link
              href={navHref(next)}
              aria-label="Next month"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Tooltip>
        </div>
      </div>

      {/* The grid below keeps rendering while this shows: the dates are real
          information, not a placeholder, and blanking them would make the
          month jump about as it loads. Only the events are pending, so only
          they get a skeleton. */}
      {isLoading && (
        <div role="status" aria-live="polite" className="pb-4">
          <span className="sr-only">Loading events</span>
          <div className="flex flex-wrap gap-2" aria-hidden>
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
          </div>
        </div>
      )}

      {/* Below sm this is an agenda, not a grid.
          Seven columns leave about 34px a cell on a phone, which fits a date
          and up to three featureless dots — no title, no time, no place, and a
          day with seven events looked identical to one with three. On the
          primary public surface of a mobile-first country, the browse
          experience carried no information at all. The grid is the desktop
          affordance; a list is what a phone can actually read. */}
      <ul className="space-y-2 sm:hidden">
        {agenda.length === 0 && !isLoading && (
          <li className="rounded-xl border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            Nothing is scheduled this month. Use the arrows above to look at
            another month.
          </li>
        )}
        {agenda.map(({ date, events: dayEvents }) => (
          <li key={date} className="rounded-xl border border-border bg-card">
            <p className="border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {new Date(date).toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
            <ul className="divide-y divide-border">
              {dayEvents.map((e) => (
                <li key={e.id}>
                  <Link
                    href={hrefForDay(toDayParam(new Date(e.startAt)))}
                    className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border ${eventColor(
                        e.colorCategory,
                        e.type,
                      )}`}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium break-words text-foreground">
                        {e.title}
                      </span>
                      {e.ministryName && (
                        <span className="mt-0.5 block text-sm font-medium text-stat-green-muted">
                          {e.ministryName}
                        </span>
                      )}
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {new Date(e.startAt).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {e.venueName ? ` · ${e.venueName}` : ''}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="hidden grid-cols-7 gap-1 sm:grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="p-1 text-center sm:p-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {w}
            </p>
          </div>
        ))}

        {cells.map((day, i) => {
          if (day === null) {
            return (
              <div key={`pad-${i}`} className="min-h-16 rounded-lg sm:min-h-32" />
            );
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
              className={`min-h-16 rounded-lg border p-1 transition-colors sm:min-h-32 sm:p-2 ${
                isToday
                  ? 'border-primary/40 bg-primary/5'
                  : dayEvents.length > 0
                    ? 'border-border/80 bg-muted/30'
                    : 'border-border/30 hover:bg-muted/20'
              }`}
            >

              <div className="mb-2 hidden items-center justify-between sm:flex">
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

              <div className="hidden space-y-1 sm:block">
                {chips.map((e) => {
                  const time = new Date(e.startAt).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const place = e.venueName;

                  return (
                    // A chip in a calendar cell is narrow enough that most
                    // titles clip, and the time and place clip with them — so
                    // the hint carries all three rather than only the name.
                    <Tooltip
                      key={e.id}
                      content={
                        <>
                          <span className="font-semibold">{e.title}</span>
                          <span className="block opacity-80">
                            {time}
                            {place ? ` · ${place}` : ''}
                          </span>
                        </>
                      }
                    >
                    <Link
                      href={hrefForEvent(e.id)}
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
                    </Tooltip>
                  );
                })}

                {more > 0 && (
                  <Tooltip content="Open this day on its own to see everything scheduled">
                    <Link
                      href={hrefForDay(dayParam)}
                      className="block rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                    >
                      +{more} more
                    </Link>
                  </Tooltip>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
