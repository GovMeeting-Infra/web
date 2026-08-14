import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PublicShell } from '@/components/PublicShell';
import { ListSkeleton } from '@/components/ui/skeletons';
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
          <ListSkeleton rows={4} label="Loading activities" />
        </PublicShell>
      }
    >
      <PublicDayView />
    </Suspense>
  );
}
