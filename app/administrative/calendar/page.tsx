'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, Building2, Globe } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { MonthGrid, monthRange, type CalendarEvent } from '@/components/calendar/MonthGrid';
import type { EventListResponse } from '@/lib/types/events';
import { PageContainer } from '@/components/ui/page-container';
import { Tooltip } from '@/components/ui/tooltip';

export default function CalendarPage() {
  const params = useSearchParams();
  const today = new Date();

  // Number(null) is 0, so a missing ?m= used to pass the 0–11 month test and
  // pin the calendar to January no matter what month it actually was. Absent
  // has to be distinguished from present-and-zero before converting.
  const yParam = params.get('y') === null ? NaN : Number(params.get('y'));
  const mParam = params.get('m') === null ? NaN : Number(params.get('m'));
  const year = Number.isInteger(yParam) && yParam > 1970 ? yParam : today.getFullYear();
  const month =
    Number.isInteger(mParam) && mParam >= 0 && mParam <= 11 ? mParam : today.getMonth();
  const view = params.get('view') === 'public' ? 'public' : 'internal';

  const { from, to } = monthRange(year, month);

  const { data, isLoading, error } = useQuery({
    queryKey: ['calendar', year, month, view],
    queryFn: () => {
      const qs = new URLSearchParams({
        from,
        to,
        sortBy: 'startAt',
        order: 'asc',
        isPublic: String(view === 'public'),
      });
      return apiFetch<EventListResponse>(`/api/v1/events?${qs.toString()}`);
    },
  });

  const events: CalendarEvent[] = (data?.data ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    startAt: e.startAt,
    endAt: e.endAt,
    colorCategory: e.colorCategory,
    type: e.type,
    venueName: e.venueName,
  }));

  const buildHref = (
    overrides: Partial<{ y: number; m: number; view: string }> = {},
    path = '/administrative/calendar',
  ) => {
    const qs = new URLSearchParams();
    if (overrides.y !== undefined) qs.set('y', String(overrides.y));
    if (overrides.m !== undefined) qs.set('m', String(overrides.m));
    qs.set('view', overrides.view ?? view);
    return `${path}?${qs.toString()}`;
  };

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-success">
            Calendar
          </p>
          <h1 className="text-3xl font-bold text-primary">
            {view === 'public' ? 'Public Calendar' : 'Internal Calendar'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Click any date to open its agenda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Internal / public toggle */}
          <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
            <Tooltip content="Meetings inside your ministry, visible only to people signed in here.">
              <Link
                href={buildHref({ y: year, m: month, view: 'internal' })}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === 'internal'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary/50'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" /> Internal
              </Link>
            </Tooltip>
            <Tooltip content="Activities listed on the public calendar, exactly as anyone outside government sees them.">
              <Link
                href={buildHref({ y: year, m: month, view: 'public' })}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === 'public'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary/50'
                }`}
              >
                <Globe className="h-3.5 w-3.5" /> Public
              </Link>
            </Tooltip>
          </div>

          <Tooltip content="Set the time, place and who is invited. The same form covers an internal meeting and a public activity.">
            <Link
              href="/administrative/events/new"
              className="flex shrink-0 items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_8px_16px_rgba(0,53,128,0.24)] transition-all hover:shadow-[0_12px_24px_rgba(0,53,128,0.32)]"
            >
              <Plus className="h-4 w-4" />
              Schedule an activity
            </Link>
          </Tooltip>
        </div>
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
        hrefForEvent={(id) => `/administrative/events/${id}`}
        hrefForDay={(d) => `/administrative/calendar/day?d=${d}&view=${view}`}
        navHref={(target) =>
          target === 'today'
            ? buildHref({ y: today.getFullYear(), m: today.getMonth() })
            : buildHref({ y: target.year, m: target.month })
        }
      />
    </PageContainer>
  );
}
