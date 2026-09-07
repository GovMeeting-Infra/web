'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DownloadCloud } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { requestPersistentStorage } from '@/lib/offline/db';
import type { EventAttendee, EventDetail } from '@/lib/types/events';

/**
 * Pull everything this meeting needs onto the device, before it is needed.
 *
 * The whole offline register depends on the invitation list already being
 * here: a roster fetched after the power cut is a roster nobody has. React
 * Query fills the cache as pages are visited, which covers the organizer who
 * browsed the meeting this morning and nobody else.
 *
 * So this is explicit and says when it finished. Staff working over a
 * connection that comes and goes need to *know* they are covered rather than
 * assume it — "Ready for offline, 42 people saved at 09:12" is a different
 * thing from a spinner that stopped.
 */
export function PrepareForOffline({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<'idle' | 'working' | 'ready' | 'failed'>(
    'idle',
  );
  const [summary, setSummary] = useState<string | null>(null);

  const prepare = async () => {
    setState('working');
    try {
      // Ask before filling it: without this IndexedDB is best effort, and the
      // browser may clear the roster under storage pressure — between the
      // meeting and the connection returning, which is the worst moment.
      await requestPersistentStorage();

      const [, attendees] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['event', eventId],
          queryFn: () => apiFetch<EventDetail>(`/api/v1/events/${eventId}`),
          staleTime: Infinity,
        }),
        queryClient.fetchQuery({
          queryKey: ['attendees-confirmed', eventId],
          queryFn: () =>
            apiFetch<EventAttendee[]>(
              `/api/v1/events/${eventId}/attendees/confirmed`,
            ),
          staleTime: Infinity,
        }),
      ]);

      const at = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setSummary(
        `Ready for offline — ${attendees.length} ${
          attendees.length === 1 ? 'person' : 'people'
        } saved at ${at}.`,
      );
      setState('ready');
    } catch {
      setState('failed');
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">
            Working without a connection
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Save this meeting&rsquo;s invitation list to this device so you can
            take attendance if the connection drops.
          </p>
        </div>
        <button
          type="button"
          onClick={prepare}
          disabled={state === 'working'}
          className="flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          <DownloadCloud className="h-4 w-4" aria-hidden="true" />
          {state === 'working' ? 'Saving…' : 'Prepare for offline'}
        </button>
      </div>

      {state === 'ready' && summary && (
        <p role="status" className="mt-3 text-sm font-medium text-success">
          {summary}
        </p>
      )}
      {state === 'failed' && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          Could not save the list. You need a connection to prepare for losing
          one — try again once you have a signal.
        </p>
      )}
    </div>
  );
}
