import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PublicShell } from '@/components/PublicShell';
import { CalendarSkeleton } from '@/components/ui/skeletons';
import { PublicCalendarView } from './PublicCalendarView';

const TITLE = 'Public Events Calendar';
const DESCRIPTION =
  'Upcoming public activities across government ministries in Sierra Leone — dates, times, venues and contact details.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website' },
};

/**
 * Public events calendar. The month is driven by ?y=&m=, and useSearchParams
 * needs a Suspense boundary or it bails the whole page out of prerendering —
 * this way the shell stays static and only the grid waits on the query string.
 */
export default function Home() {
  return (
    <Suspense
      fallback={
        <PublicShell>
          <CalendarSkeleton />
        </PublicShell>
      }
    >
      <PublicCalendarView />
    </Suspense>
  );
}
