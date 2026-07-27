import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PublicShell } from '@/components/PublicShell';
import { PublicDayView } from './PublicDayView';

// The day itself is a query parameter read client-side, so this cannot name a
// date. The calendar and the individual activities carry the specific titles.
export const metadata: Metadata = {
  title: 'Public activities by day',
  description:
    'Public government activities taking place on a given day in Sierra Leone.',
};

export default function PublicDayPage() {
  return (
    <Suspense
      fallback={
        <PublicShell>
          <p className="p-10 text-center text-sm text-slate-500">
            Loading activities…
          </p>
        </PublicShell>
      }
    >
      <PublicDayView />
    </Suspense>
  );
}
