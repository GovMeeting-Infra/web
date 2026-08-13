'use client';

import { use, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  X,
  Clock,
  UserPlus,
  BadgeCheck,
  Plus,
  Users,
  Mail,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useCurrentUser } from '@/components/SessionProvider';
import { PageContainer } from '@/components/ui/page-container';
import {
  PersonPicker,
  type DirectoryPerson,
} from '@/components/ui/person-picker';
import {
  attendeeName,
  attendeeEmail,
  CHECK_IN_METHOD_LABELS,
  ATTENDEE_STATUS_LABELS,
  type AttendeeStatus,
  type EventDetail,
  type EventAttendee,
  type AttendanceRecord,
  type ResendInviteResult,
} from '@/lib/types/events';

const STATUS_PILL: Record<AttendeeStatus, string> = {
  CONFIRMED: 'bg-[#edf8f1] text-ring',
  DECLINED: 'bg-destructive/10 text-destructive',
  INVITED: 'bg-[#fff8e5] text-[#8d6400]',
  NO_RESPONSE: 'bg-[#fff8e5] text-[#8d6400]',
};

// Five views of the same event, shown one at a time. All comes first because
// it is the set the other four are drawn from.
const TABS = [
  { key: 'all', title: 'All', icon: Users },
  { key: 'checkedIn', title: 'Checked In', icon: BadgeCheck },
  { key: 'confirmed', title: 'Confirmed', icon: Check },
  { key: 'declined', title: 'Declined', icon: X },
  { key: 'awaiting', title: 'Awaiting Response', icon: Clock },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/**
 * A row in the combined list. Two different records end up here — an invitation
 * and a check-in with no invitation behind it — so they are flattened to what
 * the list actually shows rather than rendered from two shapes.
 */
type AllRow =
  | {
      kind: 'invitee';
      id: string;
      name: string;
      email: string | null;
      status: AttendeeStatus;
      respondedAt: string | null;
    }
  | { kind: 'walkIn'; id: string; name: string; email: string | null };

/** "Invited 3 days ago", or the plain truth that nothing was ever sent. */
function invitedLabel(lastInvitedAt: string | null): string {
  if (!lastInvitedAt) return 'Not yet invited';

  const days = Math.floor(
    (Date.now() - new Date(lastInvitedAt).getTime()) / 86_400_000,
  );
  if (days <= 0) return 'Invited today';
  if (days === 1) return 'Invited yesterday';
  return `Invited ${days} days ago`;
}

function AttendeeSection({
  rows,
  emptyLabel,
  showRespondedAt = false,
  onRemove,
  onResend,
  resendingId,
}: {
  rows: EventAttendee[];
  emptyLabel: string;
  showRespondedAt?: boolean;
  onRemove?: (attendeeId: string) => void;
  onResend?: (attendeeId: string) => void;
  resendingId?: string | null;
}) {
  // No heading or icon of its own any more — the tab above supplies both, and
  // repeating them inside the panel just said the same thing twice.
  if (rows.length === 0) {
    return (
      <p className="rounded-[1.5rem] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-[1.5rem] border border-border bg-card px-6">
      {rows.map((a) => {
        const email = attendeeEmail(a);
        return (
          <li key={a.id} className="flex items-baseline justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {attendeeName(a)}
              </p>
              {email && (
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              )}
              {/* Whether an invitation actually reached them, which is the
                  thing you need to know before deciding to chase. */}
              <p className="truncate text-xs text-muted-foreground/80">
                {invitedLabel(a.lastInvitedAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {showRespondedAt && a.respondedAt && (
                <span className="text-xs text-muted-foreground">
                  {new Date(a.respondedAt).toLocaleDateString(undefined, {
                    dateStyle: 'medium',
                  })}
                </span>
              )}
              {onResend && email && (
                <button
                  onClick={() => onResend(a.id)}
                  disabled={resendingId === a.id}
                  aria-label={`Re-send invitation to ${attendeeName(a)}`}
                  title={`Re-send invitation to ${attendeeName(a)}`}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                >
                  <Mail className="h-4 w-4" />
                </button>
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
  );
}

export default function AttendeesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();

  const [walkInName, setWalkInName] = useState('');
  const [walkInEmail, setWalkInEmail] = useState('');
  // Colleagues picked from the directory, and outside guests typed by hand.
  // Both accumulate so several can go out in one invitation.
  const [invitees, setInvitees] = useState<DirectoryPerson[]>([]);
  const [guests, setGuests] = useState<{ name: string; email: string }[]>([]);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  // Per-row rather than a single boolean, so only the button that was pressed
  // shows a pending state.
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [isResendingAll, setIsResendingAll] = useState(false);
  // Not the first tab, deliberately: this page is mostly open while a meeting
  // is running, and who has actually turned up is the live question. The full
  // invite list stays first because that is the set the others are drawn from.
  const [activeTab, setActiveTab] = useState<TabKey>('checkedIn');

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

  // Everyone connected to the meeting: invitees, plus anyone who turned up
  // without an invitation. isWalkIn is the server's
  // own answer to "was this person invited?" — it is set by matching the
  // check-in against the invite list — so filtering on it cannot drift from
  // what the invite rows say. Without this, someone checked in at the desk
  // appeared under Checked In and nowhere else.
  const walkIns = checkIns.filter((c) => c.isWalkIn);
  const all: AllRow[] = [
    ...(event?.attendees ?? []).map(
      (a): AllRow => ({
        kind: 'invitee',
        id: a.id,
        name: attendeeName(a),
        email: attendeeEmail(a),
        status: a.status,
        respondedAt: a.respondedAt,
      }),
    ),
    ...walkIns.map(
      (c): AllRow => ({
        kind: 'walkIn',
        id: c.id,
        name: c.signedName,
        email: c.user?.email ?? c.guestEmail ?? null,
      }),
    ),
  ];

  // No dedicated endpoint for these — derive from the event's full attendee list.
  const awaiting = (event?.attendees ?? []).filter(
    (a) => a.status !== 'CONFIRMED' && a.status !== 'DECLINED',
  );

  // Every count is already in hand, so each tab can show its own without
  // needing the panel to be open.
  const counts: Record<TabKey, number> = {
    all: all.length,
    checkedIn: checkIns.length,
    confirmed: confirmed.length,
    declined: declined.length,
    awaiting: awaiting.length,
  };

  const isOrganizer = !!currentUser && currentUser.id === event?.organizerId;
  const isCoOrganizer =
    !!currentUser && !!event?.coOrganizers.some((c) => c.userId === currentUser.id);
  // Mirrors assertCanAdminister on the server: the organizer, a co-organizer,
  // the super admin anywhere, or a ministry-level admin on an event that has
  // no organizer to own it. The last two were missing, so the API accepted
  // invitations the page gave you no way to make.
  const isSuperAdmin = currentUser?.systemRole === 'SUPER_ADMIN';
  const canInvite =
    isOrganizer ||
    isCoOrganizer ||
    isSuperAdmin ||
    (!event?.organizerId &&
      !!currentUser &&
      ['MINISTER', 'MINISTRY_ADMIN'].includes(currentUser.systemRole));

  // POST /checkin/:eventId/manual is behind CanManageEventGuard now, so a role
  // check alone would offer the desk to people the API refuses. The server is
  // still the authority; this only decides whether to render the control.
  const canDoWalkIn =
    isOrganizer ||
    isCoOrganizer ||
    currentUser?.systemRole === 'SUPER_ADMIN' ||
    (!event?.organizerId &&
      !!currentUser &&
      ['MINISTER', 'MINISTRY_ADMIN'].includes(currentUser.systemRole) &&
      event?.ministryId === currentUser.ministryId);

  const addGuest = () => {
    const name = guestName.trim();
    const email = guestEmail.trim().toLowerCase();
    setError(null);

    if (!name) {
      setError('A guest needs a name.');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('That guest email does not look right.');
      return;
    }
    if (email && guests.some((g) => g.email === email)) {
      setError('That guest is already on the list.');
      return;
    }

    setGuests((prev) => [...prev, { name, email }]);
    setGuestName('');
    setGuestEmail('');
  };

  const handleInvite = async () => {
    const userIds = invitees.map((p) => p.id);
    // Guests carry no account, so the server records them by name and email on
    // this event alone. Blank email is dropped rather than sent as ''.
    const externals = guests.map((g) => ({
      name: g.name,
      email: g.email || undefined,
    }));

    if (userIds.length === 0 && externals.length === 0) {
      setError('Add at least one colleague or guest.');
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
      setInvitees([]);
      setGuests([]);
      setGuestName('');
      setGuestEmail('');
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite attendees.');
    } finally {
      setIsInviting(false);
    }
  };

  /**
   * Re-send one invitation. The API sends this one inline rather than queueing
   * it, so the response says whether the mail actually went — report that
   * rather than a cheerful "sent" that only means "accepted for delivery".
   */
  const handleResend = async (attendeeId: string) => {
    setError(null);
    setNotice(null);
    setResendingId(attendeeId);
    try {
      const result = await apiFetch<ResendInviteResult>(
        `/api/v1/events/${id}/attendees/${attendeeId}/invite`,
        { method: 'POST' },
      );

      if (result.emailSent) {
        setNotice(`Invitation re-sent to ${result.email}.`);
      } else {
        setError(
          `Could not email ${result.email}: ${result.emailError ?? 'unknown error'}`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to re-send.');
    } finally {
      setResendingId(null);
    }
  };

  /** Chase everyone who has not replied. Queued server-side, so no per-address outcome. */
  const handleResendAll = async () => {
    setError(null);
    setNotice(null);
    setIsResendingAll(true);
    try {
      const { queued } = await apiFetch<{ queued: number }>(
        `/api/v1/events/${id}/attendees/invite-all`,
        { method: 'POST' },
      );
      setNotice(
        queued === 0
          ? 'Nobody is awaiting a reply.'
          : `Re-sending to ${queued} attendee(s) awaiting a reply.`,
      );
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to re-send.');
    } finally {
      setIsResendingAll(false);
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
    const name = walkInName.trim();
    const email = walkInEmail.trim().toLowerCase();

    if (!name || !email) {
      setError('Name and email are both required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('That email does not look right.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      // No signature: the attendee never touches this device. The server
      // stores null and the record is shown as unsigned.
      await apiFetch(`/api/v1/checkin/${id}/manual`, {
        method: 'POST',
        body: JSON.stringify({ name, email }),
      });
      setNotice(`${name} checked in.`);
      setWalkInName('');
      setWalkInEmail('');
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
    <PageContainer className="space-y-8">
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

      {/* Side by side when the viewer can do both — two tall forms stacked
          down a full-width page pushed the lists themselves below the fold. */}
      <div
        className={`grid items-start gap-8 ${
          canInvite && canDoWalkIn ? 'xl:grid-cols-2' : ''
        }`}
      >
        {canInvite && (
        <div className="space-y-4 rounded-[1.75rem] border border-border bg-card p-8 max-sm:p-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Invite Attendees</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Invitees get an RSVP link. Minutes can only be published once an event
              has at least one attendee.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Colleagues</label>
            {/* Was a free-text box for internal user IDs, which meant asking an
                administrator for an identifier before you could invite anyone.
                Same fix already applied to the co-organizer field. */}
            <PersonPicker
              value={null}
              valueName={null}
              onChange={(person) => {
                if (person) setInvitees((prev) => [...prev, person]);
              }}
              excludeIds={[
                ...invitees.map((p) => p.id),
                ...(event?.attendees ?? [])
                  .map((a) => a.userId)
                  .filter((x): x is string => !!x),
              ]}
              placeholder="Search by name or email…"
              allowUnassign={false}
              disabled={isInviting}
            />
            {invitees.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {invitees.map((p) => (
                  <span
                    key={p.id}
                    className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-sm text-secondary-foreground"
                  >
                    {p.name}
                    <button
                      type="button"
                      onClick={() =>
                        setInvitees((prev) => prev.filter((x) => x.id !== p.id))
                      }
                      aria-label={`Remove ${p.name}`}
                      className="text-secondary-foreground/60 hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Guests <span className="text-muted-foreground">(no account)</span>
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addGuest();
                  }
                }}
                placeholder="Full name"
                className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addGuest();
                  }
                }}
                placeholder="Email (optional)"
                className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={addGuest}
                disabled={isInviting}
                className="flex items-center justify-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            {guests.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {guests.map((g) => (
                  // max-w-full and a truncating email: an address has no break
                  // opportunity, so name + email came to ~350px in a 256px
                  // card and pushed the X past main's overflow-x-hidden —
                  // leaving no way to remove a guest on a phone.
                  <span
                    key={g.email || g.name}
                    className="flex max-w-full items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm text-foreground"
                  >
                    <span className="truncate">{g.name}</span>
                    {g.email && (
                      <span className="truncate text-muted-foreground">
                        {g.email}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setGuests((prev) => prev.filter((x) => x !== g))
                      }
                      aria-label={`Remove ${g.name}`}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
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
        <div className="space-y-4 rounded-[1.75rem] border border-border bg-card p-8 max-sm:p-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Walk-in Check-In</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Records attendance at the desk. If the email belongs to an
              account, the check-in is filed against it; otherwise it is
              recorded as a guest. No signature is taken — people signing for
              themselves use the QR code.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input
              type="text"
              value={walkInName}
              onChange={(e) => setWalkInName(e.target.value)}
              placeholder="Full name"
              className="rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="email"
              value={walkInEmail}
              onChange={(e) => setWalkInEmail(e.target.value)}
              placeholder="Email"
              className="rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
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
      </div>

      {/* One list at a time. Four stacked cards meant scrolling past whichever
          was empty to reach whichever was not, on a page whose whole job is
          those lists. Pattern matches the tabs on the events list. */}
      <div>
        <div
          role="tablist"
          aria-label="Attendance lists"
          className="flex flex-wrap gap-1 border-b border-border"
        >
          {TABS.map(({ key, title, icon: Icon }) => {
            const isActive = activeTab === key;
            const count = counts[key];
            return (
              <button
                key={key}
                role="tab"
                type="button"
                id={`attendees-tab-${key}`}
                aria-selected={isActive}
                aria-controls={`attendees-panel-${key}`}
                onClick={() => setActiveTab(key)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {title}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    isActive
                      ? 'bg-secondary text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={`attendees-panel-${activeTab}`}
          aria-labelledby={`attendees-tab-${activeTab}`}
          className="pt-6"
        >
          {activeTab === 'all' &&
            (all.length === 0 ? (
              <p className="rounded-[1.5rem] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nobody has been invited or checked in yet.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-[1.5rem] border border-border bg-card px-6">
                {all.map((r) => (
                  <li
                    key={`${r.kind}-${r.id}`}
                    className="flex items-baseline justify-between gap-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {r.name}
                      </p>
                      {r.email && (
                        <p className="truncate text-xs text-muted-foreground">
                          {r.email}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {r.kind === 'invitee' ? (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            STATUS_PILL[r.status] ?? STATUS_PILL.INVITED
                          }`}
                        >
                          {ATTENDEE_STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      ) : (
                        // Never invited, but present. Worth saying so rather
                        // than showing an RSVP they were never asked for.
                        <span className="rounded-full bg-[#fff8e5] px-2.5 py-0.5 text-[11px] font-medium text-[#8d6400]">
                          Walk-in
                        </span>
                      )}
                      {/* Only invitees have an invitation to re-send. A walk-in
                          is an attendance record with nothing behind it. */}
                      {r.kind === 'invitee' && canInvite && r.email && (
                        <button
                          onClick={() => handleResend(r.id)}
                          disabled={resendingId === r.id}
                          aria-label={`Re-send invitation to ${r.name}`}
                          title={`Re-send invitation to ${r.name}`}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                      )}
                      {/* An invitation can be withdrawn; a walk-in has none, so
                          the equivalent is removing the check-in itself. */}
                      {r.kind === 'invitee' && canInvite && (
                        <button
                          onClick={() => handleRemoveAttendee(r.id)}
                          aria-label={`Remove ${r.name}`}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      {r.kind === 'walkIn' && canDoWalkIn && (
                        <button
                          onClick={() => handleRemoveCheckIn(r.id)}
                          aria-label={`Remove check-in for ${r.name}`}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ))}

          {activeTab === 'checkedIn' &&
            (checkIns.length === 0 ? (
              <p className="rounded-[1.5rem] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                Nobody has checked in yet.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-[1.5rem] border border-border bg-card px-6">
                {checkIns.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-baseline justify-between gap-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                        {c.signedName}
                        {c.isWalkIn && (
                          <span className="shrink-0 rounded-full bg-[#fff8e5] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8d6400]">
                            Walk-in
                          </span>
                        )}
                        {/* An organizer recorded this one; nobody signed. Worth
                            showing, so the list does not read as if every
                            record carries the same proof. */}
                        {c.hasSignature === false && (
                          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            No signature
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
            ))}

          {activeTab === 'confirmed' && (
            <AttendeeSection
              rows={confirmed}
              emptyLabel="No one has confirmed yet."
              showRespondedAt
              onRemove={canInvite ? handleRemoveAttendee : undefined}
              onResend={canInvite ? handleResend : undefined}
              resendingId={resendingId}
            />
          )}
          {activeTab === 'declined' && (
            <AttendeeSection
              rows={declined}
              emptyLabel="No one has declined."
              showRespondedAt
              onRemove={canInvite ? handleRemoveAttendee : undefined}
              onResend={canInvite ? handleResend : undefined}
              resendingId={resendingId}
            />
          )}
          {activeTab === 'awaiting' && (
            <div className="space-y-3">
              {/* The one place a bulk chase-up makes sense: everyone here is,
                  by definition, someone who has not replied. */}
              {canInvite && awaiting.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={handleResendAll}
                    disabled={isResendingAll}
                    className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <Mail className="h-4 w-4" />
                    {isResendingAll
                      ? 'Re-sending…'
                      : `Re-send to all ${awaiting.length} awaiting`}
                  </button>
                </div>
              )}
              <AttendeeSection
                rows={awaiting}
                emptyLabel="Everyone invited has responded."
                onRemove={canInvite ? handleRemoveAttendee : undefined}
                onResend={canInvite ? handleResend : undefined}
                resendingId={resendingId}
              />
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
