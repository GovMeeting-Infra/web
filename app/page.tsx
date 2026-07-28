import { Suspense } from 'react';
import { PublicShell } from '@/components/PublicShell';
import { PublicCalendarView } from './PublicCalendarView';

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
          <p className="p-10 text-center text-sm text-slate-500">
            Loading calendar…
          </p>
        </PublicShell>
      }
    >
      <PublicCalendarView />
    </Suspense>
  );
}
