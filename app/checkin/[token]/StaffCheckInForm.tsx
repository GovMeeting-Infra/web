'use client';

import { useRef, useState } from 'react';
import {
  SignaturePad,
  type SignaturePadHandle,
} from '@/components/ui/signature-pad';
import { useCheckInSubmit, submitLabel } from './useCheckInSubmit';
import { CheckInSuccess, AlreadyCheckedIn } from './CheckInResultView';

const field =
  'mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none';

export function StaffCheckInForm({
  token,
  eventTitle,
  venueName,
  defaultName,
  geofenceRequired,
}: {
  token: string;
  eventTitle: string;
  venueName: string | null;
  defaultName: string;
  geofenceRequired: boolean;
}) {
  const [name, setName] = useState(defaultName);
  const [hasSignature, setHasSignature] = useState(false);
  const pad = useRef<SignaturePadHandle>(null);

  const { phase, error, alreadyCheckedIn, result, submit } =
    useCheckInSubmit(geofenceRequired);

  if (result) return <CheckInSuccess result={result} />;
  if (alreadyCheckedIn) {
    return (
      <AlreadyCheckedIn
        message={error ?? 'You have already checked in.'}
        eventTitle={eventTitle}
      />
    );
  }

  const busy = phase !== 'idle';
  const canSubmit = name.trim().length >= 2 && hasSignature && !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const signature = pad.current?.getSignature();
    if (!signature) return;

    await submit(`/api/v1/checkin/${encodeURIComponent(token)}`, {
      signedName: name.trim(),
      signature,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <header className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-ring">
          Check in
        </p>
        <h1 className="mt-1 text-xl font-bold text-primary">{eventTitle}</h1>
        {venueName && (
          <p className="mt-1 text-sm text-muted-foreground">{venueName}</p>
        )}
      </header>

      {error && !alreadyCheckedIn && (
        <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-5">
        <label htmlFor="signedName" className="block text-sm font-medium text-foreground/80">
          Your name
        </label>
        <input
          id="signedName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          required
          disabled={busy}
          placeholder="Enter your name"
          className={field}
        />
      </div>

      <div className="mt-4">
        <span className="block text-sm font-medium text-foreground/80">
          Your signature
        </span>
        <div className="mt-1">
          <SignaturePad ref={pad} onChange={setHasSignature} disabled={busy} />
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-5 w-full rounded-[1.25rem] bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitLabel(phase, geofenceRequired)}
      </button>

      {geofenceRequired && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          This meeting requires you to be physically at the venue.
        </p>
      )}
    </form>
  );
}
