'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { storageUsage, type StorageUsage } from '@/lib/offline/db';
import { useOutbox } from '@/lib/offline/useOutbox';

/**
 * Warns before the device runs out of room to hold unsent work.
 *
 * The queue is the only thing here that cannot be refetched, and a browser
 * short of space evicts without asking. Signatures are what fill it — roughly
 * 30-60kB each, and a full meeting is a few megabytes — so the moment this
 * matters is exactly the moment it costs most: a register full of people who
 * signed, on a tablet that has quietly stopped being able to keep them.
 *
 * Nothing is deleted automatically. The person is told while there is still
 * room to act, because the alternative is choosing on their behalf which
 * attendance record to lose.
 */

/** Warn here rather than at the brink, so there is time to get a signal. */
const WARN_AT = 0.8;

export function StorageWarning() {
  const { pending } = useOutbox();
  const [usage, setUsage] = useState<StorageUsage | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const found = await storageUsage();
      if (!cancelled) setUsage(found);
    };

    void check();
    // Only worth re-measuring as things are added; an idle tab cannot fill up.
    const timer = window.setInterval(check, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pending.length]);

  // A browser that will not say is not a reason to alarm anyone.
  if (!usage?.ratio || usage.ratio < WARN_AT) return null;

  const megabytes = Math.round(usage.usedBytes / 1_000_000);
  const percent = Math.round(usage.ratio * 100);

  return (
    <div
      role="alert"
      className="flex items-start gap-2 border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        <strong className="font-semibold">
          This device is running out of storage
        </strong>{' '}
        ({percent}% used, about {megabytes}MB).
        {pending.length > 0 ? (
          <>
            {' '}
            {pending.length} unsent{' '}
            {pending.length === 1 ? 'change is' : 'changes are'} waiting here.
            Get a connection soon so they can be sent — the browser may start
            clearing saved data.
          </>
        ) : (
          <>
            {' '}
            Free up space on this device before working offline, or new records
            may not be saved.
          </>
        )}
      </span>
    </div>
  );
}
