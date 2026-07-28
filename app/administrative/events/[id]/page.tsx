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
import { cn } from '@/lib/utils/cn';
import { useCurrentUser } from '@/components/SessionProvider';
import {
  PersonPicker,
  type DirectoryPerson,
} from '@/components/ui/person-picker';
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
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
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
  const [coOrganizer, setCoOrganizer] = useState<DirectoryPerson | null>(null);
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
    if (!coOrganizer) return;
    setIsBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/events/${id}/co-organizers`, {
        method: 'POST',
        body: JSON.stringify({ userId: coOrganizer.id }),
      });
      setCoOrganizer(null);
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to add co-organizer',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleRemoveCoOrganizer = async (userId: string) => {
    setIsBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/events/${id}/co-organizers/${userId}`, {
        method: 'DELETE',
      });
      queryClient.invalidateQueries({ queryKey: ['event', id] });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to remove co-organizer',
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

  // Drives the two-column split below — see the comment there.
  const hasSidePanel = Boolean((myInvite && !isCancelled) || event.series);

  return (
    // flex-1 fills the viewport so Manage can sit at the bottom rather than
    // leaving a gap under it. space-y lives on the inner wrapper, not here,
    // because it would otherwise set a top margin on Manage and defeat mt-auto.
    <div className="flex w-full flex-1 flex-col p-8">
      <div className="space-y-8">
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
              {/* Draft/published is a public-calendar distinction. An internal
                  meeting is always published now, so the badge would say
                  "Published" on every one of them — which reads as "visible to
                  the public" and is the exact confusion the button caused. Only
                  "Cancelled" still tells an internal viewer anything. */}
              {(event.isPublic || isCancelled) && (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    STATUS_PILL[event.status] ?? STATUS_PILL.DRAFT
                  }`}
                >
                  {EVENT_STATUS_LABELS[event.status] ?? event.status}
                </span>
              )}
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

            {/* Publishing is what puts an activity on the public calendar, so it
                only belongs to public ones. Internal meetings are live from
                creation and never show this. */}
            {canAdminister && event.isPublic && event.status === 'DRAFT' && (
              <button
                onClick={handlePublish}
                disabled={isBusy}
                title="Make this activity visible on the public calendar"
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

        {/* Info grid. Five cards, so the fifth column matters — at lg it left a
            single orphan card on a row of its own. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
            icon={<Users className="h-4 w-4" />}
            label="Invited"
            value={`${event.attendees.length} invited · ${
              event.attendees.filter((a) => a.status === 'CONFIRMED').length
            } confirmed`}
          />
          <InfoCard
            icon={<Tag className="h-4 w-4" />}
            label="Category"
            value={event.colorCategory ?? EVENT_TYPE_LABELS[event.type]}
          />
        </div>

        {/* Two columns once there is room for them: what the event *is* on the
            left, your standing with it on the right. Below xl the whole thing
            stacks in this same order, which is the reading order the narrow
            layout had.
            Both side panels are conditional, and an organiser looking at a
            one-off meeting has neither — so the split only happens when there is
            something to put in the second column, rather than leaving a third of
            the row blank. */}
        <div
          className={cn(
            'grid grid-cols-1 gap-8',
            hasSidePanel && 'xl:grid-cols-3',
          )}
        >
          <div className={cn('space-y-8', hasSidePanel && 'xl:col-span-2')}>
            {event.description && (
              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="text-sm font-semibold text-foreground">
                  Description
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {event.description}
                </p>
              </div>
            )}

            {/* Co-organizers */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-foreground">
                Co-organizers
              </h2>
              {event.coOrganizers.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  None assigned.
                </p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {event.coOrganizers.map((co) => (
                    <li
                      key={co.id}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-muted"
                    >
                      <span className="min-w-0 truncate">
                        {co.user.name} ({co.user.email})
                      </span>
                      {canAdminister && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCoOrganizer(co.userId)}
                          disabled={isBusy}
                          aria-label={`Remove ${co.user.name} as co-organizer`}
                          title={`Remove ${co.user.name}`}
                          className="flex-shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canAdminister && (
                <div className="mt-4 flex flex-wrap items-start gap-2">
                  <div className="min-w-[16rem] flex-1">
                    {/* Was a free-text User ID box, which meant asking an
                        administrator for an internal identifier before you could
                        add a colleague. The candidates endpoint is open to every
                        role. */}
                    <PersonPicker
                      endpoint="/api/v1/events/co-organizer-candidates"
                      excludeIds={event.coOrganizers.map((c) => c.userId)}
                      value={coOrganizer?.id ?? null}
                      valueName={coOrganizer?.name ?? null}
                      onChange={setCoOrganizer}
                      placeholder="Search for a colleague…"
                      disabled={isBusy}
                    />
                  </div>
                  <button
                    onClick={handleAddCoOrganizer}
                    disabled={isBusy || !coOrganizer}
                    className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground disabled:opacity-50"
                  >
                    <UserPlus className="h-4 w-4" /> Add
                  </button>
                </div>
              )}
            </div>
          </div>

          {hasSidePanel && (
            <div className="space-y-8">
              {/* Your RSVP — only when the viewer is actually on the invitee list */}
              {myInvite && !isCancelled && (
                <div className="rounded-xl border border-border bg-card p-6">
                  <h2 className="text-sm font-semibold text-foreground">
                    Your RSVP
                  </h2>
                  <p
                    className={`mt-2 text-sm font-medium ${RSVP_COLOR[myInvite.status]}`}
                  >
                    {RSVP_LABEL[myInvite.status]}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
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
                    <h2 className="text-sm font-semibold text-foreground">
                      Recurring event
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {describeRecurrence(event.series)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* The three places this page leads to. Kept out of the two-column block
          and pinned to the bottom of the viewport — they are where you go next,
          not another card competing with the event's details. */}
      <div className="mt-auto pt-8">
        <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Manage
        </h2>
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
    </div>
  );
}
