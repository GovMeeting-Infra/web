'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Its own boundary, because this is the one page where a crash can cost a
 * meeting.
 *
 * The editor keeps a debounced copy of unsaved lines in localStorage
 * (lib/hooks/useDraftBackup.ts) and offers them back on the next visit. The
 * generic boundary would be correct but silent about that, and someone who has
 * just watched a room's worth of minutes disappear needs telling — in the
 * message, not in a support article — that reopening the page will offer the
 * text back.
 */
export default function MinutesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Minutes editor failed to render', error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto max-w-lg rounded-[1.5rem] border border-border bg-card p-8 text-center"
    >
      <h1 className="text-lg font-bold text-primary">
        The minutes editor didn&rsquo;t load
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Any lines you typed without saving are still on this device. Reopen the
        page and it will offer them back to you.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Try again
        </button>
        <Link
          href="/administrative/events"
          className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          Back to meetings
        </Link>
      </div>
      {error.digest && (
        <p className="mt-4 text-xs text-muted-foreground">
          Give support this reference: {error.digest}
        </p>
      )}
    </div>
  );
}
