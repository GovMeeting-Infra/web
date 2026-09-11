'use client';

import { use, useRef, useState } from 'react';
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
  Download,
} from 'lucide-react';
import { apiFetch, apiDownload } from '@/lib/api/client';
import { useCurrentUser } from '@/components/SessionProvider';
import { PageContainer } from '@/components/ui/page-container';
import { CheckedInTable } from './CheckedInTable';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { Tooltip } from '@/components/ui/tooltip';
import {
  PersonPicker,
  type DirectoryPerson,
} from '@/components/ui/person-picker';
import {
  attendeeName,
  attendeeEmail,
  ATTENDEE_STATUS_LABELS,
  type AttendanceExportSet,
  type AttendeeStatus,
  type EventDetail,
  type EventAttendee,
  type AttendanceRecord,
  type ResendInviteResult,
} from '@/lib/types/events';
import { useTransientMessage } from '@/lib/hooks/useTransientMessage';

/** Shared by the desk form's inputs, which were five copies of one string. */
const walkInField =
  'rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:border-primary';
import {
  SignaturePad,
  type SignaturePadHandle,
} from '@/components/ui/signature-pad';

const STATUS_PILL: Record<AttendeeStatus, string> = {
  CONFIRMED: 'bg-stat-green-bg text-success',
  DECLINED: 'bg-destructive/10 text-destructive',
  INVITED: 'bg-stat-gold-bg text-stat-gold-fg',
  NO_RESPONSE: 'bg-stat-gold-bg text-stat-gold-fg',
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

/** Each tab, in the vocabulary the export endpoint uses. */
const EXPORT_SETS: Record<TabKey, AttendanceExportSet> = {
  all: 'invited',
  checkedIn: 'checked-in',
  confirmed: 'confirmed',
  declined: 'declined',
  awaiting: 'awaiting',
};

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
                <Tooltip
                  content={`Send the invitation to ${attendeeName(a)} again. Useful when the first one never arrived.`}
                >
                  <button
                    onClick={() => onResend(a.id)}
                    disabled={resendingId === a.id}
                    aria-label={`Re-send invitation to ${attendeeName(a)}`}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                  >
                    <Mail className="h-4 w-4" />
                  </button>
                </Tooltip>
              )}
              {onRemove && (
                <Tooltip
                  content={`Take ${attendeeName(a)} off the invite list. If they have already checked in, that record stays.`}
                >
                  <button
                    onClick={() => onRemove(a.id)}
                    aria-label={`Remove ${attendeeName(a)}`}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Tooltip>
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
  const [walkInTitle, setWalkInTitle] = useState('');
  const [walkInOrganisation, setWalkInOrganisation] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');

  // Whether the email was picked from the directory, which is the only way
  // this form can know the person has an account before it asks the server.
  // A typed address might be anybody's, so the requirement is the server's to
  // enforce; this only decides what the form says it needs.
  const [walkInIsColleague, setWalkInIsColleague] = useState(false);

  // The same pad the attendee-facing form uses, including its "type it
  // instead" mode — somebody at the desk can be handed the screen, or their
  // name can be typed for them. The pad renders a typed signature in italic
  // serif so an auditor can tell the two apart.
  const walkInSignature = useRef<SignaturePadHandle>(null);

  // Correcting a row already on the register. Held as the record rather than
  // an id so the form can be seeded without another request, and so the dialog
  // can say whose check-in it is amending.
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState({
    signedName: '',
    guestName: '',
    guestEmail: '',
    guestTitle: '',
    guestOrganisation: '',
    guestPhone: '',
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const editSignature = useRef<SignaturePadHandle>(null);

  /**
   * Save a correction.
   *
   * Only who the person is. When they arrived is not sent and the server would
   * refuse it anyway — that is the record of what happened rather than data
   * entry, and a register that can be backdated is not evidence of anything.
   */
  const handleEditSave = async () => {
    if (!editing) return;

    const name = editForm.signedName.trim();
    if (!name) {
      setEditError('A name is required.');
      return;
    }

    setIsEditSaving(true);
    setEditError(null);
    try {
      const signature = editSignature.current?.getSignature();
      await apiFetch(
        `/api/v1/events/${id}/checkins/${editing.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            signedName: name,
            guestTitle: editForm.guestTitle.trim() || undefined,
            guestOrganisation: editForm.guestOrganisation.trim() || undefined,
            guestPhone: editForm.guestPhone.trim() || undefined,
            // A row filed against an account takes its name and email from
            // there, and the server refuses to re-file one as somebody else —
            // so these only travel for a guest.
            ...(editing.userId
              ? {}
              : {
                  guestName: editForm.guestName.trim() || undefined,
                  guestEmail: editForm.guestEmail.trim() || undefined,
                }),
            // Only when something was actually signed in this dialog: an
            // untouched pad must not erase a signature already on the record.
            ...(signature ? { signature } : {}),
          }),
        },
      );
      setNotice(`Check-in for ${name} corrected.`);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['checkins', id] });
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Could not save the correction.',
      );
    } finally {
      setIsEditSaving(false);
    }
  };
  // Colleagues picked from the directory, and outside guests typed by hand.
  // Both accumulate so several can go out in one invitation.
  const [invitees, setInvitees] = useState<DirectoryPerson[]>([]);
  const [guests, setGuests] = useState<{ name: string; email: string }[]>([]);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [error, setError] = useTransientMessage();
  const [notice, setNotice] = useTransientMessage();
  const [isSaving, setIsSaving] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  // Per-row rather than a single boolean, so only the button that was pressed
  // shows a pending state.
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [isResendingAll, setIsResendingAll] = useState(false);
  // Which format is being prepared, so only that button reads as busy.
  const [downloading, setDownloading] = useState<'csv' | 'pdf' | null>(null);
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

  /**
   * The attendance list. Its failure is the one that matters here: with no
   * error branch, a dropped request rendered an empty register, which on this
   * page is indistinguishable from "nobody has arrived" — the exact false
   * negative the product cannot afford.
   */
  const {
    data: checkIns = [],
    error: checkInsError,
    refetch: refetchCheckIns,
  } = useQuery({
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
  // the super admin anywhere, or a ministry-level admin on a public activity —
  // and on the ownerless events created before public activities had an
  // organizer. The last two were missing, so the API accepted invitations the
  // page gave you no way to make.
  const isSuperAdmin = currentUser?.systemRole === 'SUPER_ADMIN';
  const isMinistryLevelAdmin =
    !!currentUser && ['MINISTER', 'MINISTRY_ADMIN'].includes(currentUser.systemRole);
  const adminStandsIn =
    isMinistryLevelAdmin && (!!event?.isPublic || !event?.organizerId);
  const canInvite = isOrganizer || isCoOrganizer || isSuperAdmin || adminStandsIn;

  // POST /checkin/:eventId/manual is behind CanManageEventGuard now, so a role
  // check alone would offer the desk to people the API refuses. The server is
  // still the authority; this only decides whether to render the control.
  const canDoWalkIn =
    isOrganizer ||
    isCoOrganizer ||
    isSuperAdmin ||
    (adminStandsIn && event?.ministryId === currentUser?.ministryId);

  // Mirrors the export route's guards: the people running the meeting, plus a
  // minister across their own ministry's meetings whoever organized them.
  const canExport =
    canDoWalkIn ||
    (currentUser?.systemRole === 'MINISTER' &&
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

  /**
   * Download the list the open tab is showing. The tab keys and the sets the
   * API knows are the same five, named differently on each side.
   */
  const handleExport = async (format: 'csv' | 'pdf') => {
    const set = EXPORT_SETS[activeTab];
    setDownloading(format);
    setError(null);
    try {
      await apiDownload(
        `/api/v1/events/${id}/attendance/export?format=${format}&set=${set}`,
        `attendance-${set}.${format}`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not prepare the download.',
      );
    } finally {
      setDownloading(null);
    }
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

  /**
   * Deleting a check-in destroys the one artefact this product exists to
   * produce, and it cannot be reconstructed: the signature was drawn on the
   * attendee's own device at the moment they arrived. It was a single
   * unconfirmed tap on a 36px icon, on the phone that lives at the walk-in
   * desk. Archiving minutes — which is reversible — already asked first.
   */
  const [pendingRemoval, setPendingRemoval] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [removing, setRemoving] = useState(false);

  const handleRemoveCheckIn = async (attendanceId: string) => {
    setError(null);
    setNotice(null);
    setRemoving(true);
    try {
      await apiFetch(`/api/v1/events/${id}/checkins/${attendanceId}`, {
        method: 'DELETE',
      });
      setNotice('Check-in removed.');
      queryClient.invalidateQueries({ queryKey: ['checkins', id] });
      setPendingRemoval(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove check-in.');
    } finally {
      setRemoving(false);
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
      // A signature is offered, never required: an organizer vouching in
      // person is the point of this path, and the record says so by carrying
      // none. Trimmed values only — an empty field must not travel as '' and
      // fail an @IsString @Length on the far side.
      await apiFetch(`/api/v1/checkin/${id}/manual`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          guestTitle: walkInTitle.trim() || undefined,
          guestOrganisation: walkInOrganisation.trim() || undefined,
          guestPhone: walkInPhone.trim() || undefined,
          signature: walkInSignature.current?.getSignature() ?? undefined,
        }),
      });
      setNotice(`${name} checked in.`);
      setWalkInName('');
      setWalkInEmail('');
      setWalkInTitle('');
      setWalkInOrganisation('');
      setWalkInPhone('');
      setWalkInIsColleague(false);
      walkInSignature.current?.clear();
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
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-success">Attendance</p>
        <h1 className="text-3xl font-bold text-primary">Attendees</h1>
        {event && <p className="mt-2 text-sm text-muted-foreground">{event.title}</p>}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-ring/20 bg-stat-green-bg p-4 text-sm text-success">
          {notice}
        </div>
      )}

      {/* Side by side when the viewer can do both — two tall forms stacked
          down a full-width page pushed the lists themselves below the fold.
          
          Stretched rather than top-aligned. items-start ended each card where
          its own content ran out, so the shorter of the two left a column of
          bare page under it — and the desk form is now much the taller of the
          pair. Equal heights put that space inside a card, where it reads as
          room left over rather than as something failing to line up. */}
      <div
        className={`grid gap-8 ${
          canInvite && canDoWalkIn ? 'xl:grid-cols-2' : ''
        }`}
      >
        {canInvite && (
        <div className="flex flex-col gap-4 rounded-[1.75rem] border border-border bg-card p-8 max-sm:p-4">
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
              aria-label="Search attendees by name or email" placeholder="Search by name or email…"
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
            {/* The roster covers most of the people typed in here — ministry
                staff who simply have not been onboarded. Picking one fills
                both fields; anyone genuinely external is still typed by hand. */}
            <PersonPicker
              id="guestLookup"
              value={null}
              onChange={(person) => {
                if (!person) return;
                setGuestName(person.name);
                setGuestEmail(person.email);
              }}
              placeholder="Search colleagues and staff…"
              endpoint="/api/v1/users/directory/people?sources=accounts,staff"
              allowUnassign={false}
            />
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
                aria-label="Full name" placeholder="Full name"
                className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:border-primary"
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
                aria-label="Email (optional)" placeholder="Email (optional)"
                className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:border-primary"
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

          {/* Pinned to the foot of the card. With the two columns now equal
              height, an action floating wherever its own content happened to
              end is what actually looked unfinished — both cards close on the
              same line instead. */}
          <button
            onClick={handleInvite}
            disabled={isInviting}
            className="mt-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 font-medium text-secondary-foreground disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            {isInviting ? 'Inviting…' : 'Send Invitations'}
          </button>
        </div>
        )}

        {canDoWalkIn && (
        <div className="flex flex-col gap-4 rounded-[1.75rem] border border-border bg-card p-8 max-sm:p-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Walk-in Check-In</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Records attendance at the desk. If the email belongs to an
              account, the check-in is filed against it and their details come
              from there; otherwise it is recorded as a visitor, and who they
              came on behalf of is asked for.
            </p>
          </div>

          {/* Worth the extra control here more than anywhere else: attendance
              is unique on (eventId, guestEmail), so a slip at a desk with a
              queue behind it does not misfile the record — it creates a second
              attendee who was never in the room. */}
          <PersonPicker
            id="walkInLookup"
            value={null}
            onChange={(person) => {
              if (!person) return;
              setWalkInName(person.name);
              setWalkInEmail(person.email);
              // Chosen from the directory, so the platform holds their title
              // and ministry already and the form stops asking for them.
              setWalkInIsColleague(true);
            }}
            placeholder="Search colleagues and staff…"
            endpoint="/api/v1/users/directory/people?sources=accounts,staff"
            allowUnassign={false}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input
              type="text"
              value={walkInName}
              onChange={(e) => setWalkInName(e.target.value)}
              aria-label="Full name" placeholder="Full name"
              className={walkInField}
            />
            <input
              type="email"
              value={walkInEmail}
              onChange={(e) => {
                setWalkInEmail(e.target.value);
                // Typed over, so whatever the directory said no longer holds.
                setWalkInIsColleague(false);
              }}
              aria-label="Email" placeholder="Email"
              className={walkInField}
            />
            <input
              type="text"
              value={walkInTitle}
              onChange={(e) => setWalkInTitle(e.target.value)}
              aria-label="Job title" placeholder="Job title"
              className={walkInField}
            />
            <input
              type="text"
              value={walkInOrganisation}
              onChange={(e) => setWalkInOrganisation(e.target.value)}
              aria-label="Organisation" placeholder="Organisation"
              className={walkInField}
            />
            <input
              type="tel"
              value={walkInPhone}
              onChange={(e) => setWalkInPhone(e.target.value)}
              aria-label="Phone" placeholder="Phone"
              className={walkInField}
            />
          </div>

          {/* Said rather than enforced here: this form cannot know whether a
              typed address belongs to an account, so the server decides and
              this only sets the expectation. Picking someone from the search
              above is the one case it can be sure of. */}
          <p className="text-xs text-muted-foreground">
            {walkInIsColleague
              ? 'Job title, organisation and phone come from their account — fill them in only to record something different.'
              : 'Job title, organisation and phone are required for a visitor with no account. For a colleague, leave them blank and their account is used.'}
          </p>

          <div>
            <p className="text-sm font-medium text-foreground">
              Signature <span className="text-muted-foreground">(optional)</span>
            </p>
            <p className="mt-1 mb-2 text-xs text-muted-foreground">
              Leave it blank and the record shows that you vouched for them at
              the desk.
            </p>
            <SignaturePad
              ref={walkInSignature}
              disabled={isSaving}
              typedOnly
              typedLabel="Type the attendee's full name"
            />
          </div>

          <button
            onClick={handleWalkInCheckIn}
            disabled={isSaving}
            className="mt-auto w-full rounded-2xl bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-50"
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
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border">
        <div
          role="tablist"
          aria-label="Attendance lists"
          className="flex flex-wrap gap-1"
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

          {/* Downloads whichever list is open, so what arrives is what was
              on screen. The server decides who may — this only decides
              whether to offer it. */}
          {canExport && (
            <div className="flex items-center gap-2 pb-2">
              <Tooltip content="A spreadsheet for analysis. Signatures cannot fit in a cell, so each row only says whether one was given.">
                <button
                  type="button"
                  onClick={() => handleExport('csv')}
                  disabled={downloading !== null}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {downloading === 'csv' ? 'Preparing…' : 'CSV'}
                </button>
              </Tooltip>
              <Tooltip content="The signed register, with each signature beside the name. This is the sheet to file.">
                <button
                  type="button"
                  onClick={() => handleExport('pdf')}
                  disabled={downloading !== null}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {downloading === 'pdf' ? 'Preparing…' : 'PDF'}
                </button>
              </Tooltip>
            </div>
          )}
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
                        <span className="rounded-full bg-stat-gold-bg px-2.5 py-0.5 text-[11px] font-medium text-stat-gold-fg">
                          Walk-in
                        </span>
                      )}
                      {/* Only invitees have an invitation to re-send. A walk-in
                          is an attendance record with nothing behind it. */}
                      {r.kind === 'invitee' && canInvite && r.email && (
                        <Tooltip
                          content={`Send the invitation to ${r.name} again. Useful when the first one never arrived.`}
                        >
                        <button
                          onClick={() => handleResend(r.id)}
                          disabled={resendingId === r.id}
                          aria-label={`Re-send invitation to ${r.name}`}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                        </Tooltip>
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
                          onClick={() =>
                            setPendingRemoval({ id: r.id, name: r.name })
                          }
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

          {activeTab === 'checkedIn' && checkInsError && (
            <div
              role="alert"
              className="rounded-[1.5rem] border border-alert-border bg-alert-bg p-6 text-center"
            >
              <p className="font-medium text-alert-fg">
                We could not load the attendance record.
              </p>
              <p className="mt-1 text-sm text-alert-fg/90">
                This is a connection problem, not an empty register. Nobody has
                been removed.
              </p>
              <button
                type="button"
                onClick={() => void refetchCheckIns()}
                className="mt-4 rounded-full border border-alert-border bg-card px-4 py-2 text-sm font-medium text-alert-fg"
              >
                Try again
              </button>
            </div>
          )}

          {activeTab === 'checkedIn' && !checkInsError && (
            <CheckedInTable
              checkIns={checkIns}
              eventId={id}
              canRemove={canDoWalkIn}
              onRemove={(attendanceId, name) =>
                setPendingRemoval({ id: attendanceId, name })
              }
              onEdit={(record) => {
                setEditing(record);
                setEditError(null);
                setEditForm({
                  signedName: record.signedName ?? '',
                  guestName: record.guestName ?? '',
                  guestEmail: record.guestEmail ?? '',
                  guestTitle: record.guestTitle ?? '',
                  guestOrganisation: record.guestOrganisation ?? '',
                  guestPhone: record.guestPhone ?? '',
                });
              }}
            />
          )}

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

      {/* Correcting a row, not re-taking it. Everything about who the person
          is can be changed; when they arrived and how they checked in are not
          here and the server would refuse them anyway. */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Correct this check-in"
        description={
          editing
            ? `Recorded ${new Date(editing.checkInAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}. The arrival time and how they checked in are part of the record and cannot be changed.`
            : undefined
        }
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEditSave}
              disabled={isEditSaving}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {isEditSaving ? 'Saving…' : 'Save correction'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {editError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {editError}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-foreground/80">
              Signed name
              <input
                type="text"
                value={editForm.signedName}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, signedName: e.target.value }))
                }
                className={walkInField + ' mt-1 w-full'}
              />
            </label>

            {/* A check-in filed against an account takes these from the
                account, so offering them here would promise an edit the
                server refuses — it will not re-file attendance as somebody
                else without anyone saying so. */}
            {editing && !editing.userId && (
              <>
                <label className="text-xs font-medium text-foreground/80">
                  Guest name
                  <input
                    type="text"
                    value={editForm.guestName}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, guestName: e.target.value }))
                    }
                    className={walkInField + ' mt-1 w-full'}
                  />
                </label>
                <label className="text-xs font-medium text-foreground/80">
                  Email
                  <input
                    type="email"
                    value={editForm.guestEmail}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, guestEmail: e.target.value }))
                    }
                    className={walkInField + ' mt-1 w-full'}
                  />
                </label>
              </>
            )}

            <label className="text-xs font-medium text-foreground/80">
              Job title
              <input
                type="text"
                value={editForm.guestTitle}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, guestTitle: e.target.value }))
                }
                className={walkInField + ' mt-1 w-full'}
              />
            </label>
            <label className="text-xs font-medium text-foreground/80">
              Organisation
              <input
                type="text"
                value={editForm.guestOrganisation}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    guestOrganisation: e.target.value,
                  }))
                }
                className={walkInField + ' mt-1 w-full'}
              />
            </label>
            <label className="text-xs font-medium text-foreground/80">
              Phone
              <input
                type="tel"
                value={editForm.guestPhone}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, guestPhone: e.target.value }))
                }
                className={walkInField + ' mt-1 w-full'}
              />
            </label>
          </div>

          {editing && (
            <div>
              <p className="text-sm font-medium text-foreground">Signature</p>
              <p className="mt-1 mb-2 text-xs text-muted-foreground">
                {editing.signatureState === 'SIGNED'
                  ? 'Already signed. Type a name only to replace it — leaving this blank keeps what is on the record.'
                  : 'Not signed. Typing a name here records one on your behalf.'}
              </p>
              <SignaturePad
                ref={editSignature}
                disabled={isEditSaving}
                typedOnly
                typedLabel="Type the attendee's full name"
              />
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!pendingRemoval}
        onClose={() => setPendingRemoval(null)}
        onConfirm={() =>
          pendingRemoval && handleRemoveCheckIn(pendingRemoval.id)
        }
        title="Remove this check-in?"
        description={`This deletes the attendance record for ${pendingRemoval?.name ?? 'this attendee'}, including the signature they drew. It cannot be recovered, and they would have to check in again in person.`}
        confirmLabel="Remove check-in"
        destructive
        busy={removing}
      />
    </PageContainer>
  );
}
