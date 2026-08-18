'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { eventColor, toDayParam } from '@/lib/event-colors';
import { Skeleton } from '@/components/ui/skeleton';
import type { EventType } from '@/lib/types/events';
import { Tooltip } from '@/components/ui/tooltip';
import { useIsTruncated } from '@/lib/hooks/useIsTruncated';

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
/**
 * One event in a day cell.
 *
 * Its own component so it can measure itself: the tooltip repeats the chip's
 * own title, time and place, which at most widths are fully visible — the exact
 * noise useIsTruncated was written to prevent, and which had gone unwired while
 * this was the most-hovered tooltip in the product. Now it only appears when
 * something is genuinely cut off.
 */
function EventChip({
  href,
  title,
  detail,
  className,
}: {
  href: string;
  title: string;
  detail: string;
  className: string;
}) {
  const { ref: titleRef, isTruncated: titleClipped } =
    useIsTruncated<HTMLSpanElement>();
  const { ref: detailRef, isTruncated: detailClipped } =
    useIsTruncated<HTMLSpanElement>();
  const clipped = titleClipped || detailClipped;

  return (
    <Tooltip
      disabled={!clipped}
      content={
        <>
          <span className="font-semibold">{title}</span>
          <span className="block opacity-80">{detail}</span>
        </>
      }
    >
      <Link
        href={href}
        className={`block rounded border px-2 py-1.5 text-xs font-medium transition-shadow hover:shadow-sm ${className}`}
      >
        <span ref={titleRef} className="block truncate">
          {title}
        </span>
        <span className="mt-0.5 flex items-center gap-1 truncate opacity-75">
          <Clock className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
          <span ref={detailRef} className="truncate">
            {detail}
          </span>
        </span>
      </Link>
    </Tooltip>
  );
}

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
                      <Link
              href={navHref(prev)}
              aria-label="Previous month"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
          
                      <Link
              href={navHref('today')}
              className="flex h-10 items-center rounded-lg border border-border bg-muted px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
            >
              Today
            </Link>
          
                      <Link
              href={navHref(next)}
              aria-label="Next month"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          
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


      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="p-1 text-center sm:p-2">
            {/* "Wed" in a 34px column sits hard against its neighbours, so the
                phone gets two letters. Not one: Sun/Sat and Tue/Thu would both
                read as the same letter. */}
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs sm:tracking-wider">
              <span className="sm:hidden">{w.slice(0, 2)}</span>
              <span className="hidden sm:inline">{w}</span>
            </p>
          </div>
        ))}

        {cells.map((day, i) => {
          if (day === null) {
            return (
              <div key={`pad-${i}`} className="min-h-11 rounded-lg sm:min-h-32" />
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
              className={`min-h-11 rounded-lg border p-1 transition-colors sm:min-h-32 sm:p-2 ${
                isToday
                  ? 'border-primary/40 bg-primary/5'
                  : dayEvents.length > 0
                    ? 'border-border/80 bg-muted/30'
                    : 'border-border/30 hover:bg-muted/20'
              }`}
            >
              {/* The whole cell, because 34px leaves no room for a separate
                  hit area — and an empty day is still worth opening, since the
                  day page says so in words. Hidden above sm, where the date
                  and the chips are their own links. */}
              <Link
                href={hrefForDay(dayParam)}
                aria-label={`${cellDate.toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}, ${
                  dayEvents.length === 0
                    ? 'nothing scheduled'
                    : `${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`
                }`}
                className="flex h-full min-h-9 flex-col items-center justify-center gap-1 sm:hidden"
              >
                <span
                  className={`text-xs font-semibold ${
                    isToday ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {day}
                </span>
                {dayEvents.length > 0 && (
                  <span className="flex items-center gap-0.5" aria-hidden>
                    {dayEvents.slice(0, MAX_CHIPS).map((e) => (
                      <span
                        key={e.id}
                        className={`h-2 w-2 rounded-full border ${eventColor(
                          e.colorCategory,
                          e.type,
                        )}`}
                      />
                    ))}
                  </span>
                )}
              </Link>

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
                    <EventChip
                      key={e.id}
                      href={hrefForEvent(e.id)}
                      title={e.title}
                      detail={`${time}${place ? ` · ${place}` : ''}`}
                      className={eventColor(e.colorCategory, e.type)}
                    />
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

      {/* Under the grid on a phone, replacing it below sm.
          Seven columns leave about 34px a cell, which fits a date and a dot
          per event — enough to see the shape of the month and tap into a day,
          but no title, no time and no place. The list carries what the cell
          cannot, so the phone gets both: the grid to orient by, this to read.
          Above sm the cells are wide enough for the chips and this is dropped. */}
      <ul className="mt-4 space-y-2 border-t border-border/60 pt-4 sm:hidden">
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

    </div>
  );
}
