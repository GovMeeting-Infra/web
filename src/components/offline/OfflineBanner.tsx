'use client';

import { CloudOff } from 'lucide-react';
import { useIsOffline } from '@/lib/offline/connectivity';

/**
 * Says when what is on screen came from this device rather than the server.
 *
 * Without it the offline workspace is indistinguishable from the live one, and
 * that is the more dangerous failure: someone reads an attendee list from an
 * hour ago, believes it is current, and acts on it. The point is not to
 * apologise for the connection but to mark the page as a copy.
 *
 * Part of the shell rather than a toast. Being offline is a condition that
 * lasts, not an event that happened, and a message that fades after three
 * seconds would be gone for the whole of the outage it describes.
 */
export function OfflineBanner() {
  const offline = useIsOffline();

  if (!offline) return null;

  return (
    <div
      // `status`, not `alert`. A reader should be told, but not interrupted
      // mid-sentence — this is a standing condition, not an emergency.
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 border-b border-stat-blue-border bg-stat-blue-bg px-4 py-2 text-center text-sm text-primary"
    >
      <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        <strong className="font-semibold">You&rsquo;re offline.</strong>{' '}
        You&rsquo;re seeing what was last saved on this device. Changes
        can&rsquo;t be sent until the connection is back.
      </span>
    </div>
  );
}
