'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import {
  SignaturePad,
  type SignaturePadHandle,
} from '@/components/ui/signature-pad';
import { useCheckInSubmit, submitLabel } from './useCheckInSubmit';
import { CheckInSuccess, AlreadyCheckedIn } from './CheckInResultView';
import { LocationNotice } from './LocationNotice';
import { LocationHelp } from './LocationHelp';

const field =
  'mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none';

export function GuestCheckInForm({
  token,
  eventTitle,
  venueName,
  geofenceRequired,
  signInHref,
}: {
  token: string;
  eventTitle: string;
  venueName: string | null;
  geofenceRequired: boolean;
  signInHref: string;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [phone, setPhone] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  const pad = useRef<SignaturePadHandle>(null);

  const {
    phase,
    stage,
    error,
    helpReason,
    permission,
    alreadyCheckedIn,
    result,
    submit,
    retry,
    reportLocationProblem,
  } = useCheckInSubmit(geofenceRequired);

  if (result) return <CheckInSuccess result={result} />;

  // An email belonging to a staff account also comes back as 409, so the
  // "already checked in" panel would strand them. Offer the way out.
  const hasAccount = alreadyCheckedIn && !!error?.includes('sign in');

  if (alreadyCheckedIn && !hasAccount) {
    return (
      <AlreadyCheckedIn
        message={error ?? 'This email has already been used.'}
        eventTitle={eventTitle}
      />
    );
  }

  const busy = phase !== 'idle';
  // Known to be blocked before anyone fills in six fields and signs. The server
  // is still the authority; this only avoids inviting wasted effort.
  const blocked = geofenceRequired && permission === 'denied';
  const canSubmit =
    !blocked &&
    name.trim().length >= 2 &&
    email.trim().length > 3 &&
    title.trim().length >= 2 &&
    organisation.trim().length >= 2 &&
    phone.trim().length >= 4 &&
    hasSignature &&
    !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const signature = pad.current?.getSignature();
    if (!signature) return;

    await submit(`/api/v1/checkin/${encodeURIComponent(token)}/guest`, {
      guestName: name.trim(),
      guestEmail: email.trim(),
      guestTitle: title.trim(),
      guestOrganisation: organisation.trim(),
      guestPhone: phone.trim(),
      signature,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <header className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-ring">
          Guest check in
        </p>
        <h1 className="mt-1 text-xl font-bold text-primary">{eventTitle}</h1>
        {venueName && (
          <p className="mt-1 text-sm text-muted-foreground">{venueName}</p>
        )}
      </header>

      {blocked && !helpReason && <LocationHelp reason="DENIED" />}

      {helpReason ? (
        <LocationHelp
          reason={helpReason}
          message={error}
          onRetry={retry}
          busy={busy}
        />
      ) : (
        error && (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            <p>{error}</p>
            {hasAccount && (
              <Link
                href={signInHref}
                className="mt-2 inline-block font-medium underline underline-offset-2"
              >
                Sign in instead
              </Link>
            )}
          </div>
        )
      )}

      <div className="mt-5">
        <label htmlFor="guestName" className="block text-sm font-medium text-foreground/80">
          Your name
        </label>
        <input
          id="guestName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          required
          disabled={busy}
          placeholder="Enter your full name"
          className={field}
        />
      </div>

      <div className="mt-4">
        <label htmlFor="guestEmail" className="block text-sm font-medium text-foreground/80">
          Your email
        </label>
        <input
          id="guestEmail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={busy}
          placeholder="you@example.com"
          className={field}
        />
      </div>

      <div className="mt-4">
        <label htmlFor="guestTitle" className="block text-sm font-medium text-foreground/80">
          Your title
        </label>
        <input
          id="guestTitle"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          minLength={2}
          required
          disabled={busy}
          placeholder="e.g. Director of Planning"
          className={field}
        />
      </div>

      <div className="mt-4">
        <label htmlFor="guestOrg" className="block text-sm font-medium text-foreground/80">
          Organisation
        </label>
        <input
          id="guestOrg"
          value={organisation}
          onChange={(e) => setOrganisation(e.target.value)}
          minLength={2}
          required
          disabled={busy}
          placeholder="Who you are attending on behalf of"
          className={field}
        />
      </div>

      <div className="mt-4">
        <label htmlFor="guestPhone" className="block text-sm font-medium text-foreground/80">
          Phone number
        </label>
        <input
          id="guestPhone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          disabled={busy}
          placeholder="+232 …"
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

      <LocationNotice
        required={geofenceRequired}
        onProblem={reportLocationProblem}
      />

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-5 w-full rounded-[1.25rem] bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitLabel(phase, geofenceRequired, stage)}
      </button>


      <p className="mt-4 text-center text-xs text-muted-foreground">
        Have a staff account?{' '}
        <Link href={signInHref} className="underline underline-offset-2">
          Sign in instead
        </Link>
      </p>
    </form>
  );
}
