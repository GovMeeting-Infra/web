'use client';

import { useMemo, useSyncExternalStore } from 'react';

/**
 * What the meeting-creation page could not stay around to say.
 *
 * That page navigates here the moment a meeting is made, so anything it needs
 * to tell the organizer has to travel in the address. Two things do.
 *
 * `queued=1` means the meeting was written on the device rather than at the
 * ministry. It matters because creating a meeting normally sends its
 * invitations at once, and a queued one sends nothing until the connection
 * returns — possibly after the meeting has happened. Only the organizer can
 * judge whether that is acceptable, and only if they are told.
 *
 * `recurrenceError` has been passed here since repeat dates were added and
 * nothing ever read it, so a meeting whose series failed looked like a meeting
 * with no series. Read now, because the alternative is someone discovering it
 * when the second date does not arrive.
 */
const subscribeToNothing = () => () => {};

export function CreatedOfflineNotice() {
  const search = useSyncExternalStore(
    subscribeToNothing,
    () => window.location.search,
    () => '',
  );

  const { queued, recurrenceError } = useMemo(() => {
    const params = new URLSearchParams(search);
    return {
      queued: params.get('queued') === '1',
      recurrenceError: params.get('recurrenceError'),
    };
  }, [search]);

  if (!queued && !recurrenceError) return null;

  return (
    <>
      {queued && (
        <div
          role="status"
          className="rounded-lg border border-stat-blue-border bg-stat-blue-bg p-4 text-sm text-primary"
        >
          <p className="font-medium">
            This meeting is saved on your device, not yet at the ministry.
          </p>
          <p className="mt-1">
            It will be sent on its own once you have a connection. Invitations
            go out at that point rather than now — if the meeting is soon, tell
            people another way as well.
          </p>
        </div>
      )}

      {recurrenceError && (
        <div
          role="alert"
          className="rounded-lg border border-stat-gold-border bg-stat-gold-bg p-4 text-sm text-stat-gold-fg"
        >
          <p className="font-medium">The repeat dates were not created.</p>
          <p className="mt-1">
            This meeting was saved, but its repeats were not: {recurrenceError}
          </p>
        </div>
      )}
    </>
  );
}
