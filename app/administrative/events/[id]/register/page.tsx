'use client';

import { use, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, UserPlus, Check } from 'lucide-react';
import { apiFetch, messageFor } from '@/lib/api/client';
import type { EventAttendee, EventDetail } from '@/lib/types/events';
import { SignaturePad, type SignaturePadHandle } from '@/components/ui/signature-pad';
import { acquireLocation, type GeolocationFix } from '@/lib/hooks/useGeolocation';
import { newId } from '@/lib/offline/ids';
import { now, clockSkewMs } from '@/lib/offline/clock';
import { useIsOffline } from '@/lib/offline/connectivity';

/**
 * The register an organizer keeps at the door when there is no signal.
 *
 * This is the answer to a problem no amount of client code could solve: during
 * an outage an attendee's own phone cannot check them in, because the QR sends
 * it to a page that has to be fetched from the server nobody can reach. So one
 * device — the organizer's — becomes the book everyone signs.
 *
 * Built to be usable standing up, holding a tablet, with a queue of people
 * waiting: large targets, one thing on screen at a time, and no step that can
 * fail silently. It works identically online and off, so nobody has to decide
 * which mode they are in — the only difference is whether the write leaves
 * immediately or waits in the queue.
 */
export default function RegisterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const offline = useIsOffline();

  const { data: event } = useQuery({
    queryKey: ['event', id],
    queryFn: () => apiFetch<EventDetail>(`/api/v1/events/${id}`),
  });

  const { data: invited = [] } = useQuery({
    queryKey: ['attendees-confirmed', id],
    queryFn: () =>
      apiFetch<EventAttendee[]>(`/api/v1/events/${id}/attendees/confirmed`),
  });

  const [query, setQuery] = useState('');
  const [signing, setSigning] = useState<Signee | null>(null);
  /**
   * Who this device has recorded, by email.
   *
   * Held here rather than read back from the server, because the server is the
   * thing that may be unreachable. It is what stops the same person being
   * written into the register twice by a queue of people who all look similar
   * on a small screen.
   */
  const [recorded, setRecorded] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const roster = useMemo(() => {
    const term = query.trim().toLowerCase();
    const people = invited.map((a) => ({
      key: (a.user?.email ?? a.externalEmail ?? a.id).toLowerCase(),
      name: a.user?.name ?? a.externalName ?? 'Unnamed invitee',
      email: a.user?.email ?? a.externalEmail ?? null,
    }));
    if (!term) return people;
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.email ?? '').toLowerCase().includes(term),
    );
  }, [invited, query]);

  const record = async (
    signee: Signee,
    signature: string | null,
    fix: GeolocationFix | null,
  ) => {
    setError(null);
    try {
      await apiFetch(`/api/v1/checkin/${id}/offline-register`, {
        method: 'POST',
        body: JSON.stringify({
          records: [
            {
              // Minted here, so a batch that is sent twice cannot write anyone
              // in twice.
              id: newId(),
              signedName: signee.name,
              ...(signee.isGuest
                ? {
                    guestName: signee.name,
                    guestEmail: signee.email ?? undefined,
                    guestOrganisation: signee.organisation || undefined,
                  }
                : { email: signee.email ?? undefined }),
              signature: signature ?? undefined,
              capturedAt: now().toISOString(),
              clockSkewMs: clockSkewMs(),
              // Whatever the device managed to produce. Absent is a normal
              // answer indoors, and the server records the row either way.
              ...(fix
                ? {
                    lat: fix.latitude,
                    lng: fix.longitude,
                    gpsAccuracy: fix.accuracy,
                  }
                : {}),
            },
          ],
        }),
      });

      setRecorded((seen) => ({
        ...seen,
        [signee.key]: now().toISOString(),
      }));
      setSigning(null);
    } catch (err) {
      setError(
        messageFor(
          err,
          'That person was not recorded. Nothing has been lost — try again.',
        ),
      );
    }
  };

  if (signing) {
    return (
      <SignStep
        signee={signing}
        onCancel={() => setSigning(null)}
        onDone={(signature, fix) => record(signing, signature, fix)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      <header className="space-y-1">
        <Link
          href={`/administrative/events/${id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to the meeting
        </Link>
        <h1 className="text-2xl font-bold text-primary">Attendance register</h1>
        <p className="text-sm text-muted-foreground">
          {event?.title ?? 'Loading…'}
        </p>
      </header>

      {/*
        Said plainly rather than hidden, because the person holding the tablet
        is the one who has to answer "did that save?" if anyone asks. Both
        states are safe; they are just not the same.
      */}
      <p
        role="status"
        className="rounded-lg border border-stat-blue-border bg-stat-blue-bg p-3 text-sm text-primary"
      >
        {offline
          ? 'No connection. Everyone you record is kept on this device and sent automatically when the signal returns.'
          : 'Connected. Everyone you record is saved straight away.'}
      </p>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <label className="relative block">
        <Search
          className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="sr-only">Search the invitation list</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          className="w-full rounded-xl border border-border bg-card py-4 pl-11 pr-4 text-base"
          autoComplete="off"
        />
      </label>

      <ul className="space-y-2">
        {roster.map((person) => {
          const done = recorded[person.key];
          return (
            <li key={person.key}>
              <button
                type="button"
                disabled={!!done}
                onClick={() =>
                  setSigning({
                    key: person.key,
                    name: person.name,
                    email: person.email,
                    isGuest: false,
                  })
                }
                // Deliberately tall: this is pressed with a thumb, standing up,
                // by someone not looking closely at the screen.
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-left disabled:opacity-60"
              >
                <span>
                  <span className="block font-medium text-foreground">
                    {person.name}
                  </span>
                  {person.email && (
                    <span className="block text-sm text-muted-foreground">
                      {person.email}
                    </span>
                  )}
                </span>
                {done ? (
                  <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-success">
                    <Check className="h-4 w-4" aria-hidden="true" /> Recorded
                  </span>
                ) : (
                  <span className="shrink-0 text-sm font-semibold text-primary">
                    Check in
                  </span>
                )}
              </button>
            </li>
          );
        })}

        {roster.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {invited.length === 0
              ? 'No invitation list is saved on this device. You can still add people as guests.'
              : 'Nobody on the list matches that.'}
          </li>
        )}
      </ul>

      <GuestForm
        onAdd={(signee) => setSigning(signee)}
        recordedKeys={recorded}
      />
    </div>
  );
}

interface Signee {
  key: string;
  name: string;
  email: string | null;
  organisation?: string;
  isGuest: boolean;
}

/**
 * The signing step, on its own screen.
 *
 * One thing at a time: somebody is holding the tablet to sign, and a list of
 * other people's names underneath is both a distraction and a small privacy
 * problem.
 */
function SignStep({
  signee,
  onCancel,
  onDone,
}: {
  signee: Signee;
  onCancel: () => void;
  onDone: (signature: string | null, fix: GeolocationFix | null) => void;
}) {
  const pad = useRef<SignaturePadHandle>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [saving, setSaving] = useState(false);

  /**
   * Asked for on arrival, never waited on.
   *
   * GPS needs no internet, so a fix is usually available during an outage and
   * worth recording. But a tablet indoors can take a long time to produce one,
   * and a register that makes a queue of people wait for a satellite is a
   * register nobody uses. It starts while they sign, and whatever has arrived
   * by the time they press the button is what gets recorded — including
   * nothing, which the server accepts.
   */
  const fix = useRef<GeolocationFix | null>(null);
  useEffect(() => {
    let cancelled = false;
    void acquireLocation()
      .then((found) => {
        if (!cancelled) fix.current = found;
      })
      .catch(() => {
        // Denied, unavailable, or too slow. All the same here: the row is
        // recorded without a position rather than not at all.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = () => {
    setSaving(true);
    onDone(pad.current?.getSignature() ?? null, fix.current);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4">
      <h1 className="text-2xl font-bold text-primary">{signee.name}</h1>
      {signee.email && (
        <p className="text-sm text-muted-foreground">{signee.email}</p>
      )}

      <p className="text-sm text-foreground">
        Please sign below to confirm you attended.
      </p>

      <SignaturePad ref={pad} onChange={setHasSignature} disabled={saving} />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="flex-1 rounded-full bg-primary px-6 py-4 text-base font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? 'Recording…' : 'Record attendance'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-full border border-border px-6 py-4 text-base font-semibold text-foreground"
        >
          Cancel
        </button>
      </div>

      {/*
        A register kept on a tablet that will not take a signature is still a
        register — the same as a walk-in recorded at the desk today, which has
        no signature either. Saying so stops anyone getting stuck.
      */}
      {!hasSignature && (
        <p className="text-xs text-muted-foreground">
          You can record someone without a signature if the screen will not take
          one.
        </p>
      )}
    </div>
  );
}

/** Somebody who was not on the list. Common enough to deserve its own place. */
function GuestForm({
  onAdd,
  recordedKeys,
}: {
  onAdd: (signee: Signee) => void;
  recordedKeys: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organisation, setOrganisation] = useState('');

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm font-semibold text-primary"
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        Someone not on the list
      </button>
    );
  }

  const key = (email || name).trim().toLowerCase();
  const already = !!recordedKeys[key];

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="font-semibold text-foreground">Add someone</h2>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name"
        className="w-full rounded-lg border border-border bg-background p-3 text-base"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (optional)"
        inputMode="email"
        className="w-full rounded-lg border border-border bg-background p-3 text-base"
      />
      <input
        value={organisation}
        onChange={(e) => setOrganisation(e.target.value)}
        placeholder="Organisation (optional)"
        className="w-full rounded-lg border border-border bg-background p-3 text-base"
      />
      {already && (
        <p className="text-sm text-muted-foreground">
          Someone with that email has already been recorded on this device.
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={name.trim().length < 2 || already}
          onClick={() => {
            onAdd({
              key,
              name: name.trim(),
              email: email.trim() || null,
              organisation: organisation.trim(),
              isGuest: true,
            });
            setName('');
            setEmail('');
            setOrganisation('');
            setOpen(false);
          }}
          className="flex-1 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          Continue to signature
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
