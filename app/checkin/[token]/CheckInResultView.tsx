'use client';

import type { CheckInResult } from '@/lib/types/events';

export function CheckInSuccess({ result }: { result: CheckInResult }) {
  return (
    <div className="rounded-[1.25rem] border border-stat-green-border bg-stat-green-bg p-5 text-center text-success">
      <h1 className="text-lg font-bold">✓ Checked in</h1>
      <p className="mt-1 text-sm font-medium">{result.eventTitle}</p>
      <p className="mt-2 text-sm opacity-90">{result.signedName}</p>
      {result.withinGeofence === true && (
        <p className="mt-2 text-xs">Location verified at venue.</p>
      )}
      {result.withinGeofence === null && (
        <p className="mt-2 text-xs opacity-80">
          Recorded without location verification.
        </p>
      )}
    </div>
  );
}

export function AlreadyCheckedIn({
  message,
  eventTitle,
}: {
  message: string;
  eventTitle: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-stat-gold-border bg-stat-gold-bg p-5 text-center text-stat-gold-fg">
      <h1 className="text-lg font-bold">Already checked in</h1>
      <p className="mt-1 text-sm font-medium">{eventTitle}</p>
      <p className="mt-2 text-sm opacity-90">{message}</p>
    </div>
  );
}
