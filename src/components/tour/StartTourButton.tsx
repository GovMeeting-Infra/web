'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Compass } from 'lucide-react';

/**
 * Restarts the guided tour.
 *
 * The tour runs itself once and then records that it has, so without this the
 * only way back would be editing the database — and someone who clicked past it
 * on their first morning is exactly the person who wants it again.
 *
 * Clears the completion flag, seeds the tour at step zero, and lands on the
 * dashboard, where PlatformTour picks it up.
 */
export function StartTourButton() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  const start = async () => {
    setStarting(true);
    try {
      sessionStorage.setItem('govmeeting.tour', JSON.stringify({ index: 0 }));
    } catch {
      // Storage refused: the tour cannot survive the page hops, so say so
      // rather than starting something that will stop after one step.
      setStarting(false);
      alert(
        'The tour needs browser storage, which appears to be blocked for this site.',
      );
      return;
    }
    router.push('/administrative/dashboard');
  };

  return (
    <button
      onClick={start}
      disabled={starting}
      // Styled for the dark header it sits on — the only place it is used.
      // text-foreground is near-black, which on the navy bg-primary card read
      // as an unlabelled box until you hovered it and the light hover fill
      // arrived. White text with a white-tinted border reads at rest, and the
      // hover just deepens the existing white/10 chip behind it.
      className="flex items-center gap-2 rounded-[1.25rem] border border-white/30 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-60"
    >
      <Compass className="h-4 w-4" />
      {starting ? 'Starting…' : 'Take the tour'}
    </button>
  );
}
