'use client';

import { CloudOff, UploadCloud } from 'lucide-react';
import { useIsOffline } from '@/lib/offline/connectivity';
import { useOutbox } from '@/lib/offline/useOutbox';

/**
 * Says when what is on screen came from this device rather than the server, and
 * whether anything is still waiting to go the other way.
 *
 * Without it the offline workspace is indistinguishable from the live one, and
 * that is the more dangerous failure: someone reads an attendee list from an
 * hour ago, believes it is current, and acts on it. The point is not to
 * apologise for the connection but to mark the page as a copy.
 *
 * It also stays up while online with a queue still draining, because "am I
 * safe to close this laptop" is the question people actually have, and the
 * connection returning is not the same as the work having arrived.
 *
 * Part of the shell rather than a toast. Being offline is a condition that
 * lasts, not an event that happened, and a message that fades after three
 * seconds would be gone for the whole of the outage it describes.
 */
export function OfflineBanner() {
  const offline = useIsOffline();
  const { pending } = useOutbox();

  if (!offline && pending.length === 0) return null;

  const waiting = pending.length;
  const plural = waiting === 1 ? 'change' : 'changes';

  /*
   * Two different things reach this banner and they are not the same news.
   *
   * The device having no connection is one. The other is the meetings service
   * being down behind a web page that loaded perfectly well — the browser is
   * online, and telling someone in that situation to check their connection
   * sends them to reboot a router that is working.
   */
  const noConnection =
    typeof navigator !== 'undefined' && navigator.onLine === false;

  return (
    <div
      // `status`, not `alert`. A reader should be told, but not interrupted
      // mid-sentence — this is a standing condition, not an emergency.
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 border-b border-stat-blue-border bg-stat-blue-bg px-4 py-2 text-center text-sm text-primary"
    >
      {offline ? (
        <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <UploadCloud className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span>
        {offline ? (
          <>
            <strong className="font-semibold">
              {noConnection
                ? 'You’re offline.'
                : 'We can’t reach the service.'}
            </strong>{' '}
            You&rsquo;re seeing what was last saved on this device.
            {waiting > 0 && (
              <>
                {' '}
                {waiting} {plural}{' '}
                {noConnection
                  ? 'will be sent when the connection is back.'
                  : 'will be sent as soon as it answers.'}
              </>
            )}
          </>
        ) : (
          <>
            <strong className="font-semibold">Catching up.</strong> Sending{' '}
            {waiting} {plural} saved on this device.
          </>
        )}
      </span>
    </div>
  );
}
