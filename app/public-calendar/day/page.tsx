import { Suspense } from 'react';
import { PublicShell } from '@/components/PublicShell';
import { PublicDayView } from './PublicDayView';

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
