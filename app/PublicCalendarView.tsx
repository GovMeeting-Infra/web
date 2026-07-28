'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PublicShell } from '@/components/PublicShell';
import { apiFetch } from '@/lib/api/client';
import { MonthGrid, monthRange, type CalendarEvent } from '@/components/calendar/MonthGrid';
import type { PublicEventListItem } from '@/lib/types/events';

export function PublicCalendarView() {
  const params = useSearchParams();
  const today = new Date();

  // Number(null) is 0, which passed the 0–11 month test below and pinned a
  // param-less calendar to January. See the same fix in the internal calendar.
  const yParam = params.get('y') === null ? NaN : Number(params.get('y'));
  const mParam = params.get('m') === null ? NaN : Number(params.get('m'));
  const year = Number.isInteger(yParam) && yParam > 1970 ? yParam : today.getFullYear();
  const month =
    Number.isInteger(mParam) && mParam >= 0 && mParam <= 11 ? mParam : today.getMonth();

  const { from, to } = monthRange(year, month);

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-calendar', year, month],
    queryFn: () =>
      apiFetch<PublicEventListItem[]>(
        `/api/v1/public/events?${new URLSearchParams({ from, to }).toString()}`,
      ),
  });

  const events: CalendarEvent[] = (data ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    startAt: e.startAt,
    endAt: e.endAt,
    colorCategory: e.colorCategory,
    type: e.type,
    venueName: e.venueName,
  }));

  return (
    <PublicShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#003580] sm:text-3xl">
            Upcoming public activities
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Published events across government ministries. Select a date to see that
            day&apos;s activities.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : 'Failed to load the calendar'}
          </div>
        )}

        <MonthGrid
          year={year}
          month={month}
          events={events}
          isLoading={isLoading}
          hrefForEvent={(id) => `/public-calendar/event/${id}`}
          hrefForDay={(d) => `/public-calendar/day?d=${d}`}
          navHref={(target) =>
            target === 'today' ? '/' : `/?y=${target.year}&m=${target.month}`
          }
        />
      </div>
    </PublicShell>
  );
}
