'use client';

import { use, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock, MapPin, Check, X } from 'lucide-react';
import { apiFetch, messageFor } from '@/lib/api/client';
import { PublicShell } from '@/components/PublicShell';
import { useTransientMessage } from '@/lib/hooks/useTransientMessage';

/**
 * The RSVP page.
 *
 * It used to ask "Will you be attending?" on a card that never named the
 * meeting, the ministry, the date or the place — the recipient had to go back
 * to the email to find out what they were answering. It also ran on none of the
 * design tokens (from-blue-50, text-green-600, text-slate-600), used raw fetch
 * instead of apiFetch, and carried no government identity at all, on a link
 * sent to people who may never have seen this product.
 */

interface Invitation {
  event: {
    title: string;
    description: string | null;
    startAt: string;
    endAt: string;
    venueName: string | null;
    ministry: { name: string } | null;
  };
  inviteeName: string | null;
  status: 'INVITED' | 'CONFIRMED' | 'DECLINED';
  respondedAt: string | null;
}

const DATE = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PublicShell
      title="Meeting Invitation"
      linkHome={false}
      footerNote="This invitation was sent to you by the organising ministry."
    >
      <div className="mx-auto max-w-xl py-6">{children}</div>
    </PublicShell>
  );
}

export default function RSVPPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [answered, setAnswered] = useState<'CONFIRMED' | 'DECLINED' | null>(
    null,
  );
  const [saving, setSaving] = useState<'CONFIRMED' | 'DECLINED' | null>(null);
  const [error, setError] = useTransientMessage();

  const {
    data: invitation,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ['rsvp', token],
    queryFn: () => apiFetch<Invitation>(`/api/v1/rsvp/${token}`),
    retry: false,
  });

  const respond = async (status: 'CONFIRMED' | 'DECLINED') => {
    setSaving(status);
    setError(null);
    try {
      await apiFetch(`/api/v1/rsvp/${token}`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      setAnswered(status);
    } catch (err) {
      setError(
        messageFor(
          err,
          'We could not record your reply. Try again, or reply to the invitation email.',
        ),
      );
    } finally {
      setSaving(null);
    }
  };

  if (isLoading) {
    return (
      <Shell>
        <div role="status" className="space-y-3">
          <span className="sr-only">Loading your invitation</span>
          <div className="h-7 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-32 animate-pulse rounded-[1.5rem] bg-muted" />
        </div>
      </Shell>
    );
  }

  if (loadError || !invitation) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold text-primary">
          This invitation link is no longer valid
        </h1>
        <p className="mt-3 text-muted-foreground">
          The link may have expired, or it may have been replaced by a newer
          invitation. Check for a more recent email from the organising
          ministry, or reply to that email to confirm your place.
        </p>
      </Shell>
    );
  }

  const { event } = invitation;
  // A reply already on file, whether it arrived just now or on a previous
  // visit. Both should look the same — the person is done either way.
  const settled = answered ?? (invitation.respondedAt ? invitation.status : null);
  const attending = settled === 'CONFIRMED';

  return (
    <Shell>
      <h1 className="text-2xl font-bold text-primary sm:text-3xl">
        {event.title}
      </h1>
      {event.ministry && (
        <p className="mt-1.5 font-medium text-stat-green-muted">
          Hosted by {event.ministry.name}
        </p>
      )}

      <dl className="mt-6 space-y-3 rounded-[1.5rem] border border-border bg-card p-5">
        <div className="flex gap-3">
          <CalendarDays
            className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div>
            <dt className="sr-only">Date</dt>
            <dd className="font-medium text-foreground">
              {DATE.format(new Date(event.startAt))}
            </dd>
          </div>
        </div>
        <div className="flex gap-3">
          <Clock
            className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div>
            <dt className="sr-only">Time</dt>
            <dd className="font-medium text-foreground">
              {TIME.format(new Date(event.startAt))}–
              {TIME.format(new Date(event.endAt))}
            </dd>
          </div>
        </div>
        {event.venueName && (
          <div className="flex gap-3">
            <MapPin
              className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div>
              <dt className="sr-only">Place</dt>
              <dd className="font-medium text-foreground">{event.venueName}</dd>
            </div>
          </div>
        )}
      </dl>

      {event.description && (
        <p className="mt-4 whitespace-pre-line text-muted-foreground">
          {event.description}
        </p>
      )}

      {settled ? (
        <div
          role="status"
          className={`mt-6 rounded-[1.5rem] border p-5 ${
            attending
              ? 'border-stat-green-border bg-stat-green-bg'
              : 'border-border bg-muted/40'
          }`}
        >
          <p
            className={`flex items-center gap-2 font-semibold ${
              attending ? 'text-stat-green-muted' : 'text-foreground'
            }`}
          >
            {attending ? (
              <Check className="h-5 w-5 shrink-0" aria-hidden />
            ) : (
              <X className="h-5 w-5 shrink-0" aria-hidden />
            )}
            {attending
              ? 'You are down as attending'
              : 'You are down as not attending'}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {attending
              ? 'The organiser has your reply. Bring a phone if you can — you will check in by scanning a code in the room.'
              : 'The organiser has your reply. If your plans change, reply to the invitation email and they can update it.'}
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <h2 className="font-semibold text-foreground">
            Can you attend?
          </h2>
          {error && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-alert-border bg-alert-bg p-3 text-sm text-alert-fg"
            >
              {error}
            </p>
          )}
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => respond('CONFIRMED')}
              disabled={!!saving}
              className="flex min-h-[3rem] flex-1 items-center justify-center gap-2 rounded-[1.25rem] bg-primary px-5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              <Check className="h-4 w-4" aria-hidden />
              {saving === 'CONFIRMED' ? 'Recording…' : 'Yes, I will attend'}
            </button>
            <button
              type="button"
              onClick={() => respond('DECLINED')}
              disabled={!!saving}
              className="flex min-h-[3rem] flex-1 items-center justify-center gap-2 rounded-[1.25rem] border border-border bg-card px-5 font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
            >
              <X className="h-4 w-4" aria-hidden />
              {saving === 'DECLINED' ? 'Recording…' : 'No, I cannot attend'}
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}
