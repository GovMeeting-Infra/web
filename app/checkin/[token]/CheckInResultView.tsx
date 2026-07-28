'use client';

import type { CheckInResult } from '@/lib/types/events';

export function CheckInSuccess({ result }: { result: CheckInResult }) {
  return (
    <div className="rounded-[1.25rem] border border-[#cfe5d7] bg-[#edf8f1] p-5 text-center text-[#007236]">
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
    <div className="rounded-[1.25rem] border border-[#fde8a6] bg-[#fff8e5] p-5 text-center text-[#8d6400]">
      <h1 className="text-lg font-bold">Already checked in</h1>
      <p className="mt-1 text-sm font-medium">{eventTitle}</p>
      <p className="mt-2 text-sm opacity-90">{message}</p>
    </div>
  );
}
