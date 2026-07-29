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
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useCurrentUser } from '@/components/SessionProvider';
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
} from '@/lib/types/events';

// Four views of the same event, shown one at a time. Order puts who actually
// turned up first — that is what the desk is looking at during a meeting.
const STATUS_PILL: Record<AttendeeStatus, string> = {
  CONFIRMED: 'bg-[#edf8f1] text-ring',
  DECLINED: 'bg-destructive/10 text-destructive',
  INVITED: 'bg-[#fff8e5] text-[#8d6400]',
  NO_RESPONSE: 'bg-[#fff8e5] text-[#8d6400]',
};

const TABS = [
  { key: 'all', title: 'All Invited', icon: Users },
  { key: 'checkedIn', title: 'Checked In', icon: BadgeCheck },
  { key: 'confirmed', title: 'Confirmed', icon: Check },
  { key: 'declined', title: 'Declined', icon: X },
  { key: 'awaiting', title: 'Awaiting Response', icon: Clock },
] as const;

type TabKey = (typeof TABS)[number]['key'];

function AttendeeSection({
  rows,
  emptyLabel,
  showRespondedAt = false,
  showStatus = false,
  onRemove,
}: {
  rows: EventAttendee[];
  emptyLabel: string;
  showRespondedAt?: boolean;
  /** Only the combined list needs it — the others are already one status. */
  showStatus?: boolean;
  onRemove?: (attendeeId: string) => void;
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
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {showStatus && (
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    STATUS_PILL[a.status] ?? STATUS_PILL.INVITED
                  }`}
                >
                  {ATTENDEE_STATUS_LABELS[a.status] ?? a.status}
                </span>
              )}
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
  const [activeTab, setActiveTab] = useState<TabKey>('all');

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

  // Everyone asked, whatever they answered. The event's own attendee list is
  // already the full set — confirmed/declined have their own endpoints, but
  // those are the same rows split three ways.
  const all = event?.attendees ?? [];

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
  const canInvite = isOrganizer || isCoOrganizer;

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
    <div className="w-full space-y-8 p-8">
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
        <div className="space-y-4 rounded-[1.75rem] border border-border bg-card p-8">
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
                  <span
                    key={g.email || g.name}
                    className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm text-foreground"
                  >
                    {g.name}
                    {g.email && (
                      <span className="text-muted-foreground">{g.email}</span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setGuests((prev) => prev.filter((x) => x !== g))
                      }
                      aria-label={`Remove ${g.name}`}
                      className="text-muted-foreground hover:text-destructive"
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
        <div className="space-y-4 rounded-[1.75rem] border border-border bg-card p-8">
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
          {activeTab === 'all' && (
            <AttendeeSection
              rows={all}
              emptyLabel="Nobody has been invited yet."
              showStatus
              onRemove={canInvite ? handleRemoveAttendee : undefined}
            />
          )}

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
            />
          )}
          {activeTab === 'declined' && (
            <AttendeeSection
              rows={declined}
              emptyLabel="No one has declined."
              showRespondedAt
              onRemove={canInvite ? handleRemoveAttendee : undefined}
            />
          )}
          {activeTab === 'awaiting' && (
            <AttendeeSection
              rows={awaiting}
              emptyLabel="Everyone invited has responded."
              onRemove={canInvite ? handleRemoveAttendee : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}
