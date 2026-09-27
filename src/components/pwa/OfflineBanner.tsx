'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react';
import {
  getConnectivity,
  getServerConnectivity,
  subscribeToConnectivity,
} from '@/lib/pwa/connectivity';

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "2 hours ago", from a timestamp. Coarse on purpose: it is a warning, not a log. */
function ago(at: number, now: number): string {
  const minutes = Math.round((at - now) / 60_000);
  if (minutes > -1) return 'just now';
  if (minutes > -60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relative.format(hours, 'hour');
  return relative.format(Math.round(hours / 24), 'day');
}

/**
 * Says the workspace is offline, and how old what is on screen is.
 *
 * A standing banner rather than a toast: being offline is a condition that
 * lasts, and someone reading a meeting's minutes needs to know for as long as
 * they are reading that the page cannot have changed since it was saved.
 *
 * The age is the oldest answer any mounted query is showing — the one most
 * likely to be out of date is the one worth warning about.
 */
export function OfflineBanner() {
  const state = useSyncExternalStore(
    subscribeToConnectivity,
    getConnectivity,
    getServerConnectivity,
  );
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => Date.now());

  // Keeps "5 minutes ago" true while the banner stays up, and picks up saved
  // answers as they are restored or pages change — only while offline, so a
  // connected session pays nothing for it.
  useEffect(() => {
    if (state !== 'offline') return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    const unsubscribe = queryClient.getQueryCache().subscribe(() => setNow(Date.now()));
    return () => {
      clearInterval(id);
      unsubscribe();
    };
  }, [state, queryClient]);

  if (state !== 'offline') return null;

  const oldest = queryClient
    .getQueryCache()
    .getAll()
    .filter((q) => q.getObserversCount() > 0 && q.state.dataUpdatedAt > 0)
    .reduce<number | null>(
      (min, q) => (min === null ? q.state.dataUpdatedAt : Math.min(min, q.state.dataUpdatedAt)),
      null,
    );

  return (
    <div
      role="status"
      className="flex items-start gap-3 border-b border-accent/40 bg-accent/15 px-4 py-2.5 text-sm text-accent-foreground sm:px-6"
    >
      <WifiOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <span className="font-semibold">You&rsquo;re offline.</span>{' '}
        {oldest
          ? `Showing what was saved on this device, last updated ${ago(oldest, now)}.`
          : 'Showing what was saved on this device.'}{' '}
        Changes can&rsquo;t be sent until the connection is back.
      </p>
    </div>
  );
}
