'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  FileText,
  Zap,
  Edit,
  Trash2,
  Send,
  Tag,
  UserPlus,
  Ban,
  Repeat,
  Check,
  X,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useCurrentUser } from '@/components/SessionProvider';
import {
  EVENT_TYPE_LABELS,
  EVENT_STATUS_LABELS,
  FREQUENCY_LABELS,
  type EventDetail,
  type EventStatus,
} from '@/lib/types/events';

const STATUS_PILL: Record<EventStatus, string> = {
  PUBLISHED: 'bg-[#edf8f1] text-ring',
  DRAFT: 'bg-[#edf3fd] text-primary',
  CANCELLED: 'bg-muted text-muted-foreground',
};

const RSVP_LABEL: Record<string, string> = {
  INVITED: 'Awaiting your response',
  NO_RESPONSE: 'Awaiting your response',
  CONFIRMED: 'You confirmed attendance',
  DECLINED: 'You declined',
};

const RSVP_COLOR: Record<string, string> = {
  INVITED: 'text-[#8a6d00]',
  NO_RESPONSE: 'text-[#8a6d00]',
  CONFIRMED: 'text-ring',
  DECLINED: 'text-destructive',
};

/** Human sentence for a recurrence rule, e.g. "Weekly · 4 occurrences". */
function describeRecurrence(series: NonNullable<EventDetail['series']>): string {
  const every =
    series.interval > 1
      ? `Every ${series.interval} × ${FREQUENCY_LABELS[series.frequency].toLowerCase()}`
      : FREQUENCY_LABELS[series.frequency];

  if (series.endType === 'COUNT' && series.count) {
    return `${every} · ${series.count} occurrences`;
  }
  if (series.endType === 'UNTIL' && series.until) {
    return `${every} · until ${new Date(series.until).toLocaleDateString(undefined, { dateStyle: 'medium' })}`;
  }
  return `${every} · no end date`;
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function ActionTile({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-6 text-center transition-all hover:border-primary/30 hover:shadow-[0_8px_24px_rgba(0,53,128,0.08)]"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-primary">
        {icon}
      </div>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </Link>
  );
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [coOrganizerInput, setCoOrganizerInput] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => apiFetch<EventDetail>(`/api/v1/events/${id}`),
  });

  const isOrganizer = !!currentUser && !!event && currentUser.id === event.organizerId;
  const isCoOrganizer =
    !!currentUser && !!event?.coOrganizers.some((c) => c.userId === currentUser.id);
  const isMinistryAdmin =
    !!currentUser &&
    ['SUPER_ADMIN', 'MINISTER', 'MINISTRY_ADMIN'].includes(currentUser.systemRole);

  // These mirror the server: editing is open to co-organizers and ministry
  // admins, cancelling to organizers and co-organizers, while publish and
  // delete stay organizer-only.
  // Public activities have no organizer, so admins stand in for one — mirrors
  // assertCanAdminister on the server.
  const isOrganizerless = !!event && event.organizerId === null;
  const canAdminister = isOrganizer || (isOrganizerless && isMinistryAdmin);

  const canEdit = canAdminister || isCoOrganizer || isMinistryAdmin;
  const canCancel = canAdminister || isCoOrganizer;
  const isCancelled = event?.status === 'CANCELLED';

  const myInvite =
    currentUser && event
      ? event.attendees.find((a) => a.userId === currentUser.id)
      : undefined;
  const canSeeUserPicker =
    currentUser?.systemRole === 'SUPER_ADMIN' || currentUser?.systemRole === 'MINISTRY_ADMIN';

  const handlePublish = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/events/${id}/publish`, { method: 'POST' });
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish event');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRsvp = async (status: 'CONFIRMED' | 'DECLINED') => {
    setIsBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/events/${id}/rsvp`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record your RSVP');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/events/${id}/cancel`, { method: 'POST' });
      setConfirmCancel(false);
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel event');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/events/${id}`, { method: 'DELETE' });
      router.push('/administrative/events');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
      setIsBusy(false);
    }
  };

  const handleAddCoOrganizer = async () => {
    if (!coOrganizerInput.trim()) return;
    setIsBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/events/${id}/co-organizers`, {
        method: 'POST',
        body: JSON.stringify({ userId: coOrganizerInput.trim() }),
      });
      setCoOrganizerInput('');
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to add co-organizer',
      );
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading event...
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Event not found.
      </div>
    );
  }

  const start = new Date(event.startAt);
  const end = new Date(event.endAt);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <Link
        href="/administrative/events"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Events
      </Link>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-primary">{event.title}</h1>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                STATUS_PILL[event.status] ?? STATUS_PILL.DRAFT
              }`}
            >
              {EVENT_STATUS_LABELS[event.status] ?? event.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {EVENT_TYPE_LABELS[event.type]}
            {event.organizer && ` • Organized by ${event.organizer.name}`}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {canEdit && !isCancelled && (
            <Link
              href={`/administrative/events/${event.id}/edit`}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <Edit className="h-4 w-4" /> Edit
            </Link>
          )}

          {canAdminister && event.status === 'DRAFT' && (
            <button
              onClick={handlePublish}
              disabled={isBusy}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> Publish
            </button>
          )}

          {canCancel && !isCancelled && (
            <button
              onClick={handleCancel}
              disabled={isBusy}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                confirmCancel
                  ? 'bg-[#fab700] text-primary'
                  : 'border border-border text-foreground hover:bg-muted'
              }`}
            >
              <Ban className="h-4 w-4" />
              {confirmCancel ? 'Confirm Cancel' : 'Cancel Event'}
            </button>
          )}

          {canAdminister && (
            <button
              onClick={handleDelete}
              disabled={isBusy}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                confirmDelete
                  ? 'bg-destructive text-destructive-foreground'
                  : 'border border-destructive/30 text-destructive hover:bg-destructive/5'
              }`}
            >
              <Trash2 className="h-4 w-4" />
              {confirmDelete ? 'Confirm Delete' : 'Delete'}
            </button>
          )}

          {!canAdminister && !canEdit && (
            <p className="max-w-xs text-right text-xs text-muted-foreground">
              You don&apos;t have permission to manage this event.
            </p>
          )}
        </div>
      </div>

      {isCancelled && (
        <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
          This event has been cancelled.
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard
          icon={<Calendar className="h-4 w-4" />}
          label="Start"
          value={start.toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        />
        <InfoCard
          icon={<Calendar className="h-4 w-4" />}
          label="End"
          value={end.toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        />
        <InfoCard
          icon={<MapPin className="h-4 w-4" />}
          label="Venue"
          value={event.room?.name ?? event.venueName ?? 'Not set'}
        />
        <InfoCard
          icon={<Tag className="h-4 w-4" />}
          label="Category"
          value={event.colorCategory ?? EVENT_TYPE_LABELS[event.type]}
        />
        <InfoCard
          icon={<Users className="h-4 w-4" />}
          label="Invited"
          value={`${event.attendees.length} invited · ${
            event.attendees.filter((a) => a.status === 'CONFIRMED').length
          } confirmed`}
        />
      </div>

      {event.description && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground">Description</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {event.description}
          </p>
        </div>
      )}

      {/* Your RSVP — only when the viewer is actually on the invitee list */}
      {myInvite && !isCancelled && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground">Your RSVP</h2>
          <p className={`mt-2 text-sm font-medium ${RSVP_COLOR[myInvite.status]}`}>
            {RSVP_LABEL[myInvite.status]}
          </p>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => handleRsvp('CONFIRMED')}
              disabled={isBusy || myInvite.status === 'CONFIRMED'}
              className="flex items-center gap-2 rounded-xl bg-ring px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
            >
              <Check className="h-4 w-4" /> Confirm Attendance
            </button>
            <button
              onClick={() => handleRsvp('DECLINED')}
              disabled={isBusy || myInvite.status === 'DECLINED'}
              className="flex items-center gap-2 rounded-xl border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:opacity-40"
            >
              <X className="h-4 w-4" /> Decline
            </button>
          </div>
        </div>
      )}

      {/* Recurrence */}
      {event.series && (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Recurring event</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {describeRecurrence(event.series)}
          </p>
        </div>
      )}

      {/* Co-organizers */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Co-organizers</h2>
        {event.coOrganizers.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">None assigned.</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {event.coOrganizers.map((co) => (
              <li key={co.id} className="text-sm text-foreground">
                {co.user.name} ({co.user.email})
              </li>
            ))}
          </ul>
        )}
        {canAdminister && (
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              placeholder={canSeeUserPicker ? 'User ID' : 'User ID (ask an admin for this)'}
              value={coOrganizerInput}
              onChange={(e) => setCoOrganizerInput(e.target.value)}
              className="flex-1 rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={handleAddCoOrganizer}
              disabled={isBusy || !coOrganizerInput.trim()}
              className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" /> Add
            </button>
          </div>
        )}
      </div>

      {/* Action tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ActionTile
          href={`/administrative/events/${event.id}/attendees`}
          icon={<Users className="h-5 w-5" />}
          label="Attendees"
        />
        <ActionTile
          href={`/administrative/events/${event.id}/checkin-code`}
          icon={<Zap className="h-5 w-5" />}
          label="Check-in QR"
        />
        <ActionTile
          href={`/administrative/events/${event.id}/minutes`}
          icon={<FileText className="h-5 w-5" />}
          label="Meeting Minutes"
        />
      </div>
    </div>
  );
}
