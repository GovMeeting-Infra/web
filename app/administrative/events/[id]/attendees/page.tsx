'use client';

import { use, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import SignatureCanvas from 'react-signature-canvas';
import { ArrowLeft, Check, X, Clock, UserPlus, BadgeCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useCurrentUser } from '@/components/SessionProvider';
import {
  attendeeName,
  attendeeEmail,
  CHECK_IN_METHOD_LABELS,
  type EventDetail,
  type EventAttendee,
  type AttendanceRecord,
} from '@/lib/types/events';

function AttendeeSection({
  title,
  icon,
  rows,
  emptyLabel,
  showRespondedAt = false,
  onRemove,
}: {
  title: string;
  icon: React.ReactNode;
  rows: EventAttendee[];
  emptyLabel: string;
  showRespondedAt?: boolean;
  onRemove?: (attendeeId: string) => void;
}) {
  return (
    <div className="rounded-[1.5rem] border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-primary">
          {icon}
        </span>
        <h2 className="text-sm font-semibold text-foreground">
          {title} ({rows.length})
        </h2>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {rows.map((a) => {
            const email = attendeeEmail(a);
            return (
              <li key={a.id} className="flex items-baseline justify-between gap-4 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {attendeeName(a)}
                  </p>
                  {email && (
                    <p className="truncate text-xs text-muted-foreground">{email}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {showRespondedAt && a.respondedAt && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.respondedAt).toLocaleDateString(undefined, {
                        dateStyle: 'medium',
                      })}
                    </span>
                  )}
                  {onRemove && (
                    <button
                      onClick={() => onRemove(a.id)}
                      aria-label={`Remove ${attendeeName(a)}`}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function AttendeesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const signCanvasRef = useRef<SignatureCanvas>(null);

  const [walkInName, setWalkInName] = useState('');
  const [walkInUserId, setWalkInUserId] = useState('');
  const [inviteUserIds, setInviteUserIds] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  const { data: event } = useQuery({
    queryKey: ['event', id],
    queryFn: () => apiFetch<EventDetail>(`/api/v1/events/${id}`),
  });

  const { data: confirmed = [] } = useQuery({
    queryKey: ['attendees-confirmed', id],
    queryFn: () => apiFetch<EventAttendee[]>(`/api/v1/events/${id}/attendees/confirmed`),
  });

  const { data: declined = [] } = useQuery({
    queryKey: ['attendees-declined', id],
    queryFn: () => apiFetch<EventAttendee[]>(`/api/v1/events/${id}/attendees/declined`),
  });

  const { data: checkIns = [] } = useQuery({
    queryKey: ['checkins', id],
    queryFn: () => apiFetch<AttendanceRecord[]>(`/api/v1/events/${id}/checkins`),
  });

  // No dedicated endpoint for these — derive from the event's full attendee list.
  const awaiting = (event?.attendees ?? []).filter(
    (a) => a.status !== 'CONFIRMED' && a.status !== 'DECLINED',
  );

  const isOrganizer = !!currentUser && currentUser.id === event?.organizerId;
  const isCoOrganizer =
    !!currentUser && !!event?.coOrganizers.some((c) => c.userId === currentUser.id);
  const canInvite = isOrganizer || isCoOrganizer;

  // Matches the role list on POST /checkin/:eventId/manual (MINISTER excluded).
  const canDoWalkIn =
    !!currentUser &&
    ['SUPER_ADMIN', 'MINISTRY_ADMIN', 'STAFF'].includes(currentUser.systemRole);

  const handleInvite = async () => {
    const userIds = inviteUserIds
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const externals = guestName.trim()
      ? [{ name: guestName.trim(), email: guestEmail.trim() || undefined }]
      : [];

    if (userIds.length === 0 && externals.length === 0) {
      setError('Enter at least one user ID or a guest name.');
      return;
    }

    setIsInviting(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/v1/events/${id}/attendees`, {
        method: 'POST',
        body: JSON.stringify({ userIds, externals }),
      });
      setNotice(`Invited ${userIds.length + externals.length} attendee(s).`);
      setInviteUserIds('');
      setGuestName('');
      setGuestEmail('');
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite attendees.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveAttendee = async (attendeeId: string) => {
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/v1/events/${id}/attendees/${attendeeId}`, {
        method: 'DELETE',
      });
      setNotice('Invitation removed.');
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['attendees-confirmed', id] });
      queryClient.invalidateQueries({ queryKey: ['attendees-declined', id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove invitation.');
    }
  };

  const handleRemoveCheckIn = async (attendanceId: string) => {
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/v1/events/${id}/checkins/${attendanceId}`, {
        method: 'DELETE',
      });
      setNotice('Check-in removed.');
      queryClient.invalidateQueries({ queryKey: ['checkins', id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove check-in.');
    }
  };

  const handleWalkInCheckIn = async () => {
    if (!walkInName.trim() || !walkInUserId.trim()) {
      setError('Name and user ID are both required.');
      return;
    }
    const signature = signCanvasRef.current?.isEmpty()
      ? null
      : signCanvasRef.current?.getTrimmedCanvas().toDataURL();
    if (!signature) {
      setError('Please capture the attendee’s signature.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/v1/checkin/${id}/manual`, {
        method: 'POST',
        body: JSON.stringify({
          userId: walkInUserId.trim(),
          signedName: walkInName.trim(),
          signature,
        }),
      });
      setNotice(`${walkInName.trim()} checked in.`);
      setWalkInName('');
      setWalkInUserId('');
      signCanvasRef.current?.clear();
      queryClient.invalidateQueries({ queryKey: ['checkins', id] });
      queryClient.invalidateQueries({ queryKey: ['attendees-confirmed', id] });
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check in attendee.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <Link
        href={`/administrative/events/${id}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Event
      </Link>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-ring">Attendance</p>
        <h1 className="text-3xl font-bold text-primary">Attendees</h1>
        {event && <p className="mt-2 text-sm text-muted-foreground">{event.title}</p>}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-ring/20 bg-[#edf8f1] p-4 text-sm text-ring">
          {notice}
        </div>
      )}

      {canInvite && (
        <div className="space-y-4 rounded-[1.75rem] border border-border bg-card p-8">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Invite Attendees</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Invitees get an RSVP link. Minutes can only be published once an event
              has at least one attendee.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              User IDs <span className="text-muted-foreground">(comma or space separated)</span>
            </label>
            <input
              type="text"
              value={inviteUserIds}
              onChange={(e) => setInviteUserIds(e.target.value)}
              placeholder="usr-staff-001, usr-admin-002"
              className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Guest name</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="For someone without an account"
                className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Guest email</label>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <button
            onClick={handleInvite}
            disabled={isInviting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 font-medium text-secondary-foreground disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            {isInviting ? 'Inviting…' : 'Send Invitations'}
          </button>
        </div>
      )}

      {canDoWalkIn && (
        <div className="space-y-4 rounded-[1.75rem] border border-border bg-card p-8">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Walk-in Check-In</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Records attendance on someone’s behalf. Requires their user ID — ask an
              administrator if you don’t have it.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input
              type="text"
              value={walkInName}
              onChange={(e) => setWalkInName(e.target.value)}
              placeholder="Full name as signed"
              className="rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="text"
              value={walkInUserId}
              onChange={(e) => setWalkInUserId(e.target.value)}
              placeholder="User ID"
              className="rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Signature</label>
            <div className="overflow-hidden rounded-2xl border border-border bg-white">
              <SignatureCanvas
                ref={signCanvasRef}
                canvasProps={{ width: 280, height: 150, className: 'w-full border-0' }}
                penColor="black"
                backgroundColor="white"
              />
            </div>
            <button
              type="button"
              onClick={() => signCanvasRef.current?.clear()}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Clear signature
            </button>
          </div>

          <button
            onClick={handleWalkInCheckIn}
            disabled={isSaving}
            className="w-full rounded-2xl bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-50"
          >
            {isSaving ? 'Checking in…' : 'Check In'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-[1.5rem] border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-primary">
              <BadgeCheck className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold text-foreground">
              Checked In ({checkIns.length})
            </h2>
          </div>

          {checkIns.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nobody has checked in yet.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {checkIns.map((c) => (
                <li key={c.id} className="flex items-baseline justify-between gap-4 py-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                      {c.signedName}
                      {c.isWalkIn && (
                        <span className="shrink-0 rounded-full bg-[#fff8e5] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8d6400]">
                          Walk-in
                        </span>
                      )}
                    </p>
                    {/* Guests have no linked account, so fall back to the email
                        they signed in with. */}
                    {(c.user?.email || c.guestEmail) && (
                      <p className="truncate text-xs text-muted-foreground">
                        {c.user?.email ?? c.guestEmail}
                        {!c.userId && ' · guest'}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {CHECK_IN_METHOD_LABELS[c.checkInMethod] ?? c.checkInMethod} ·{' '}
                      {new Date(c.checkInAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                    {canDoWalkIn && (
                      <button
                        onClick={() => handleRemoveCheckIn(c.id)}
                        aria-label={`Remove check-in for ${c.signedName}`}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <AttendeeSection
          title="Confirmed"
          icon={<Check className="h-4 w-4" />}
          rows={confirmed}
          emptyLabel="No one has confirmed yet."
          showRespondedAt
          onRemove={canInvite ? handleRemoveAttendee : undefined}
        />
        <AttendeeSection
          title="Declined"
          icon={<X className="h-4 w-4" />}
          rows={declined}
          emptyLabel="No one has declined."
          showRespondedAt
          onRemove={canInvite ? handleRemoveAttendee : undefined}
        />
        <AttendeeSection
          title="Awaiting Response"
          icon={<Clock className="h-4 w-4" />}
          rows={awaiting}
          emptyLabel="Everyone invited has responded."
          onRemove={canInvite ? handleRemoveAttendee : undefined}
        />
      </div>
    </div>
  );
}
