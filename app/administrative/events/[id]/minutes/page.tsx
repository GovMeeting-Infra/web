'use client';

import { use, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  Send,
  Plus,
  Archive,
  Lock,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { apiFetch, ApiError, messageFor } from '@/lib/api/client';
import { useCurrentUser } from '@/components/SessionProvider';
import {
  useUnsavedWarning,
  confirmLeave,
} from '@/lib/hooks/useUnsavedWarning';
import {
  useDraftBackup,
  discardDraftBackup,
} from '@/lib/hooks/useDraftBackup';
import { Modal } from '@/components/ui/modal';
import { PersonPicker } from '@/components/ui/person-picker';
import {
  ACTION_ITEM_STATUS_LABELS,
  type EventDetail,
  type Minutes,
  type ActionItem,
} from '@/lib/types/events';
import { PageContainer } from '@/components/ui/page-container';
import { CardSkeleton } from '@/components/ui/skeletons';
import { MinutesRecord, pointsOfType } from '@/components/minutes/MinutesRecord';
import { PointList } from './PointList';
import { useTransientMessage } from '@/lib/hooks/useTransientMessage';

/**
 * The heading used to print the raw enum — "Status: PUBLISHED" — while the
 * minutes list one click away rendered the same states properly.
 */
const STATUS_WORDS: Record<string, string> = {
  DRAFT: 'Draft — not yet sent to attendees',
  PUBLISHED: 'Published and sent to attendees',
  ARCHIVED: 'Archived — permanent, and can no longer be changed',
};

/**
 * What the server says about editing, publishing and archiving this record.
 *
 * The page used to keep its own copies of these rules — organiser-or-
 * co-organiser for publishing, MINISTER/SUPER_ADMIN for archiving — which is
 * the client re-implementing capability checks the API already owns.
 */
interface EditPermission {
  canEdit: boolean;
  reason:
    | 'OPEN'
    | 'ADMIN_OVERRIDE'
    | 'WINDOW_CLOSED'
    | 'NOT_ORGANIZER'
    | 'ARCHIVED'
    | 'OTHER_MINISTRY'
    | 'NOT_FOUND';
  editWindowEndsAt: string | null;
  canPublish: { allowed: boolean; blockedReason: string | null };
  canArchive: boolean;
  canReadArchived: boolean;
  recipients: { total: number; external: number };
}

function deadlineText(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MinutesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const [decisions, setDecisions] = useState<string[]>([]);
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useTransientMessage();
  const [newActionItem, setNewActionItem] = useState<{
    title: string;
    description: string;
    dueDate: string;
    ownerId: string | null;
    ownerName: string | null;
    ownerEmail: string;
  }>({
    title: '',
    description: '',
    dueDate: '',
    ownerId: null,
    ownerName: null,
    ownerEmail: '',
  });
  const [isAddingActionItem, setIsAddingActionItem] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [confirmingPublish, setConfirmingPublish] = useState(false);

  const { data: event } = useQuery({
    queryKey: ['event', id],
    queryFn: () => apiFetch<EventDetail>(`/api/v1/events/${id}`),
  });

  /**
   * Only a 404 means "no minutes drafted yet".
   *
   * The catch-all used to swallow every failure into null, and `handleSave`
   * reads null as "create" — so a dropped connection opened a blank editor for
   * a meeting that already had minutes, and the first save POSTed a second set
   * over an existing record instead of amending it. A network blip could
   * therefore lose a meeting's decisions.
   */
  const { data: minutes, error: minutesError } = useQuery({
    queryKey: ['minutes', id],
    queryFn: async () => {
      try {
        return await apiFetch<Minutes>(`/api/v1/events/${id}/minutes`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });

  const { data: actionItems = [] } = useQuery({
    queryKey: ['actionItems', id],
    queryFn: async () => {
      if (!minutes) return [];
      try {
        return await apiFetch<ActionItem[]>(`/api/v1/events/${id}/action-items`);
      } catch {
        return [];
      }
    },
    enabled: !!minutes,
  });

  /**
   * Seed the editor from the server, without ever overwriting live typing.
   *
   * This was an effect keyed on the query object, which re-ran whenever the
   * fetched record differed from the cached one — which is precisely when it
   * does damage. Three ways it destroyed work: saving and continuing to type
   * (the invalidation's refetch returned the older saved text and replaced
   * what came after the click); publishing with unsaved lines in the fields
   * (status changes, so the object changes); and tabbing away and back while a
   * co-organiser saved, because the QueryClient is created bare and so
   * refetchOnWindowFocus is on with staleTime 0.
   *
   * Seeding now happens during render, once per server version, and only while
   * the editor is clean. A version arriving while the person has unsaved work
   * is surfaced (below) rather than applied.
   */
  const serverVersion = minutes ? `${minutes.id}:${minutes.updatedAt}` : null;
  const [seededVersion, setSeededVersion] = useState<string | null>(null);
  const [conflictVersion, setConflictVersion] = useState<string | null>(null);

  const serverDecisions = minutes
    ? pointsOfType(minutes.points, 'DECISION').map((p) => p.text)
    : [];
  const serverNextSteps = minutes
    ? pointsOfType(minutes.points, 'NEXT_STEP').map((p) => p.text)
    : [];

  /**
   * Whether the editor holds anything the server has not been told about.
   *
   * Compared against what was last loaded rather than tracked with a flag, so
   * typing a decision and deleting it again correctly counts as clean. This is
   * the page someone uses to transcribe a meeting as it happens, and the "Back
   * to Event" link sits directly above the editor.
   */
  // Element-wise. This compared join()ed strings using a literal NUL byte as
  // the separator — correct, because a NUL cannot appear in typed text, but an
  // invisible control character in source that breaks grep, sed and most
  // editors. Comparing the arrays says the same thing in a way you can read.
  const sameLines = (a: string[], b: string[]) => {
    const left = a.map((v) => v.trim()).filter(Boolean);
    const right = b.map((v) => v.trim()).filter(Boolean);
    return left.length === right.length && left.every((v, i) => v === right[i]);
  };
  const isDirty =
    !sameLines(decisions, serverDecisions) ||
    !sameLines(nextSteps, serverNextSteps);

  // The seed itself: render-time, once per server version, deferring to unsaved
  // work instead of replacing it.
  if (serverVersion && serverVersion !== seededVersion) {
    if (seededVersion === null || !isDirty) {
      setDecisions(serverDecisions);
      setNextSteps(serverNextSteps);
      setSeededVersion(serverVersion);
      if (conflictVersion) setConflictVersion(null);
    } else if (conflictVersion !== serverVersion) {
      setConflictVersion(serverVersion);
    }
  }

  useUnsavedWarning(isDirty);
  const restorableDraft = useDraftBackup(id, decisions, nextSteps, isDirty);

  // The 2-day edit window and its ministry-admin override live on the server;
  // ask rather than re-deriving them here.
  const { data: editPermission, isPending: permissionPending } = useQuery({
    queryKey: ['minutes-can-edit', id],
    queryFn: () =>
      apiFetch<EditPermission>(`/api/v1/events/${id}/minutes/can-edit`),
  });

  const isSuperAdmin = currentUser?.systemRole === 'SUPER_ADMIN';
  const isPublished = minutes?.status === 'PUBLISHED';

  // Genuinely archived: frozen by the retention job once the meeting is old
  // enough, and readable only by ministry leadership.
  const isArchived = minutes?.status === 'ARCHIVED';

  // Super-admins read published minutes without editing them. This is a
  // read-only view, not an archived record — the two were previously conflated
  // under the same "Archived" wording.
  const isReadOnlyView = (isPublished && isSuperAdmin) || isArchived;
  const canEdit = !!editPermission?.canEdit && !isReadOnlyView;

  // From the server, not re-derived here. This was `systemRole === 'MINISTER'
  // || isSuperAdmin`, a second copy of the @Roles() on the archive endpoints
  // that nothing would have caught drifting.
  const canManageArchive = !!editPermission?.canArchive;

  const handleArchiveToggle = async () => {
    const restoring = isArchived;
    if (
      !restoring &&
      !window.confirm(
        'Archive these minutes? The record becomes permanent — nobody will be able to edit it, and only ministers will be able to read it.',
      )
    ) {
      return;
    }

    setIsArchiving(true);
    setError(null);
    try {
      await apiFetch(
        `/api/v1/events/${id}/minutes/${restoring ? 'restore' : 'archive'}`,
        { method: 'POST' },
      );
      queryClient.invalidateQueries({ queryKey: ['minutes', id] });
      queryClient.invalidateQueries({ queryKey: ['minutes-can-edit', id] });
    } catch (err) {
      setError(
        messageFor(
          err,
          `These minutes weren't ${restoring ? 'restored' : 'archived'}. Try again.`,
        ),
      );
    } finally {
      setIsArchiving(false);
    }
  };

  /**
   * Whether publishing is offered, and why not.
   *
   * Both came from the server rather than being mirrored here. The old copy
   * re-derived the organiser check and counted saved points itself, which meant
   * two ways to be wrong: the wording drifted from the sentence the server
   * throws, and someone who had typed five decisions without saving was told
   * "Record a decision first" — true of the server's view, baffling from theirs.
   */
  const publishBlockedReason = editPermission?.canPublish.blockedReason ?? null;
  const canPublish = !!editPermission?.canPublish.allowed;
  const isOrganizer = !!currentUser && currentUser.id === event?.organizerId;
  const isCoOrganizer =
    !!currentUser && !!event?.coOrganizers.some((c) => c.userId === currentUser.id);
  // Unsaved work is its own blocker, and a clearer one than the server's view
  // of an empty record.
  const publishNeedsSave = isDirty;

  const handleSaveMinutes = async () => {
    setIsSaving(true);
    setError(null);
    // Both lists are sent every time, including empty ones: that is how a
    // drafter deletes their last decision.
    const payload = JSON.stringify({
      decisions: decisions.map((d) => d.trim()).filter(Boolean),
      nextSteps: nextSteps.map((s) => s.trim()).filter(Boolean),
    });
    try {
      await apiFetch(`/api/v1/events/${id}/minutes`, {
        method: minutes ? 'PATCH' : 'POST',
        body: payload,
      });
      queryClient.invalidateQueries({ queryKey: ['minutes', id] });
      queryClient.invalidateQueries({ queryKey: ['minutes-can-edit', id] });
      discardDraftBackup(id);
      setSavedAt(
        new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      );
    } catch (err) {
      setError(
        messageFor(
          err,
          "Your minutes weren't saved. Check your connection and try again — nothing you typed has been lost.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/events/${id}/minutes/publish`, { method: 'POST' });
      queryClient.invalidateQueries({ queryKey: ['minutes', id] });
      queryClient.invalidateQueries({ queryKey: ['minutes-can-edit', id] });
      setConfirmingPublish(false);
    } catch (err) {
      setError(
        messageFor(
          err,
          "The minutes weren't sent. Nothing has gone out — try again.",
        ),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddActionItem = async () => {
    if (!newActionItem.title.trim() || !newActionItem.dueDate) return;
    setIsAddingActionItem(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/events/${id}/minutes/action-items`, {
        method: 'POST',
        body: JSON.stringify({
          title: newActionItem.title,
          dueDate: new Date(newActionItem.dueDate).toISOString(),
          // A guest: id is a marker for someone with no account, not something
          // the server can look up — they are assigned by email instead.
          ownerId: newActionItem.ownerId?.startsWith('guest:')
            ? undefined
            : (newActionItem.ownerId ?? undefined),
          // These three were collected, shown, and then dropped on the way
          // out. The email one mattered most: for someone with no account it
          // is the only way the item reaches them, so an item assigned to an
          // outside participant was assigned to nobody.
          description: newActionItem.description.trim() || undefined,
          ownerName: newActionItem.ownerName?.trim() || undefined,
          ownerEmail: newActionItem.ownerEmail.trim() || undefined,
        }),
      });
      setNewActionItem({
        title: '',
        description: '',
        dueDate: '',
        ownerId: null,
        ownerName: null,
        ownerEmail: '',
      });
      queryClient.invalidateQueries({ queryKey: ['actionItems', id] });
    } catch (err) {
      setError(messageFor(err, "That action item wasn't added. Try again."));
    } finally {
      setIsAddingActionItem(false);
    }
  };

  const handleUpdateActionStatus = async (itemId: string, newStatus: string) => {
    try {
      await apiFetch(`/api/v1/events/${id}/action-items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      queryClient.invalidateQueries({ queryKey: ['actionItems', id] });
    } catch (err) {
      setError(messageFor(err, "That change wasn't saved. Try again."));
    }
  };

  /**
   * Public activities have no minutes — the server refuses to create them and
   * the event page hides the tile. The URL stayed reachable, so a bookmark or a
   * shared link opened a full editor that failed only once somebody had typed a
   * record into it and pressed save.
   */
  if (event?.isPublic) {
    return (
      <PageContainer>
        <div className="rounded-[1.5rem] border border-border bg-card p-8 text-center">
          <p className="font-medium text-foreground">
            Public activities do not have minutes
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Attendance is recorded on the activity itself. Minutes are for
            internal meetings.
          </p>
          <Link
            href={`/administrative/events/${id}`}
            className="mt-5 inline-flex items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the activity
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-8">
      <Link
        href={`/administrative/events/${id}`}
        // The App Router has no navigation blocker, so beforeunload alone would
        // let this link discard a half-written record silently.
        onClick={(e) => {
          if (!confirmLeave(isDirty)) e.preventDefault();
        }}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to event
      </Link>

      {/* Blocks the editor rather than letting someone type into a record we
          could not read. Saving from here would have created a second set of
          minutes for a meeting that already had one. */}
      {minutesError && (
        <div
          role="alert"
          className="rounded-[1.5rem] border border-alert-border bg-alert-bg p-5"
        >
          <p className="font-semibold text-alert-fg">
            We could not load the minutes for this meeting.
          </p>
          <p className="mt-1 text-sm text-alert-fg/90">
            Do not start typing yet — this is a connection problem, and anything
            written now could be saved as a second, separate record. Reload the
            page once you have a signal.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {/* The event was fetched and never rendered, so someone writing up
              the second of two back-to-back meetings had nothing on screen to
              catch them typing into the wrong one. */}
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-success">
            Minutes
          </p>
          <h1 className="mt-1 text-3xl font-bold text-primary">
            {event?.title ?? 'Meeting minutes'}
          </h1>
          {event && (
            <p className="mt-2 text-sm text-muted-foreground">
              {new Date(event.startAt).toLocaleString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {event.venueName ? ` · ${event.venueName}` : ''}
              {` · ${event.attendees.length} ${event.attendees.length === 1 ? 'attendee' : 'attendees'}`}
            </p>
          )}
          {minutes && (
            <p className="mt-1 text-sm text-muted-foreground">
              {STATUS_WORDS[minutes.status] ?? minutes.status}
            </p>
          )}
          {/* The deadline, while it still means something. It was never shown
              anywhere — people learned the window existed by hitting the end
              of it. */}
          {canEdit && editPermission?.reason === 'OPEN' && editPermission.editWindowEndsAt && (
            <p className="mt-1 text-sm text-muted-foreground">
              You can correct these until {deadlineText(editPermission.editWindowEndsAt)}.
            </p>
          )}
          {canEdit && editPermission?.reason === 'ADMIN_OVERRIDE' && (
            <p className="mt-1 text-sm text-stat-gold-fg">
              The two-day window closed on{' '}
              {deadlineText(editPermission.editWindowEndsAt)}. You can still
              make corrections because you administer this ministry.
            </p>
          )}
        </div>

        {canManageArchive && minutes && (isPublished || isArchived) && (
          <button
            onClick={handleArchiveToggle}
            disabled={isArchiving}
            className="flex items-center gap-2 rounded-[1.25rem] border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-60"
          >
            {isArchived ? (
              <RotateCcw className="h-4 w-4" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            {isArchiving
              ? isArchived
                ? 'Restoring…'
                : 'Archiving…'
              : isArchived
                ? 'Restore from archive'
                : 'Archive record'}
          </button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {/* Announced, because a save that worked is the thing the person is
          waiting to be told and nothing was telling them. */}
      <p role="status" aria-live="polite" className="sr-only">
        {savedAt ? `Minutes saved at ${savedAt}.` : ''}
      </p>

      {conflictVersion && (
        <div
          role="alert"
          className="rounded-lg border border-stat-gold-border bg-stat-gold-bg p-4 text-sm text-stat-gold-fg"
        >
          <p className="font-medium">Someone else has changed these minutes.</p>
          <p className="mt-1">
            Your unsaved lines are still here and have not been touched. Saving
            will replace their version with yours — copy anything you need
            first, then reload.
          </p>
        </div>
      )}

      {restorableDraft && !isDirty && (
        <div className="rounded-lg border border-stat-blue-border bg-stat-blue-bg p-4 text-sm text-primary">
          <p className="font-medium">
            You have unsaved lines from{' '}
            {new Date(restorableDraft.savedAt).toLocaleString('en-GB', {
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}
            .
          </p>
          <p className="mt-1">
            They were kept on this device when the page closed before saving.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setDecisions(restorableDraft.decisions);
                setNextSteps(restorableDraft.nextSteps);
                discardDraftBackup(id);
              }}
              className="rounded-[1.25rem] bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
            >
              Put them back
            </button>
            <button
              type="button"
              onClick={() => discardDraftBackup(id)}
              className="rounded-[1.25rem] border border-border px-4 py-2 text-xs font-medium text-foreground"
            >
              Discard them
            </button>
          </div>
        </div>
      )}

      {/* The record takes the full width, and what it produced sits in its own
          container below. The action item form needs five fields across; a
          one-third rail could not carry them. */}
      <div className="space-y-8">
        <div className="space-y-8">
      {isReadOnlyView && minutes && (
        <div className="space-y-4 rounded-[1.75rem] border border-border bg-card p-8 max-sm:p-4">
          <div className="flex items-center gap-2">
            {isArchived ? (
              <Archive className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Lock className="h-4 w-4 text-muted-foreground" />
            )}
            <h2 className="text-sm font-semibold text-foreground">
              {isArchived ? 'Archived record' : 'Read-only view'}
            </h2>
          </div>

          <p className="text-xs text-muted-foreground">
            {isArchived
              ? 'These minutes were archived because the meeting is over six months old. The record is permanent and can no longer be changed.'
              : 'This record has been published. Only the organisers can change it.'}
          </p>

          <MinutesRecord points={minutes.points} actionItems={actionItems} />

          <div className="border-t border-border pt-4 text-xs text-muted-foreground">
            {minutes.publishedBy && <>Published by {minutes.publishedBy.name}</>}
            {minutes.publishedAt && (
              <>
                {minutes.publishedBy ? ' · ' : ''}
                {new Date(minutes.publishedAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* Never a permission verdict from an unresolved query. This branch used
          to render while the can-edit request was still in flight, so every
          organiser was told they could not write up their own meeting — for a
          flash on a desk, for seconds on the phone this product is built for. */}
      {permissionPending && !isReadOnlyView && (
        <div className="space-y-3 rounded-[1.75rem] border border-border bg-card p-8 max-sm:p-4">
          <CardSkeleton lines={4} label="Opening the minutes" />
        </div>
      )}

      {!permissionPending && !canEdit && !isReadOnlyView && (
        <div className="space-y-3 rounded-[1.75rem] border border-border bg-card p-8 max-sm:p-4">
          {/* One string used to cover two unrelated situations, name no date
              and offer nobody to ask. The server distinguishes them now. */}
          <p className="text-sm text-muted-foreground">
            {editPermission?.reason === 'WINDOW_CLOSED'
              ? `The two-day window for correcting these closed on ${deadlineText(editPermission.editWindowEndsAt)}. A ministry admin can still make changes — ask yours if something here is wrong.`
              : editPermission?.reason === 'NOT_ORGANIZER'
                ? 'Only the organiser and co-organisers write these minutes. You can read them here.'
                : editPermission?.reason === 'OTHER_MINISTRY'
                  ? 'These minutes belong to another ministry.'
                  : 'You can read these minutes but not change them.'}
          </p>
          {minutes && (
            <MinutesRecord points={minutes.points} actionItems={actionItems} />
          )}
        </div>
      )}

      {canEdit && (
        <div className="space-y-4 rounded-[1.75rem] border border-border bg-card p-8 max-sm:p-4">
          <PointList
            label="Decisions"
            singular="Decision"
            hint="What the meeting settled. One line each."
            placeholder="e.g. Approved the Q3 budget at Le 4.2bn"
            addLabel="Add decision"
            icon={<CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />}
            values={decisions}
            onChange={setDecisions}
            disabled={isSaving}
          />

          <PointList
            label="Next steps"
            singular="Next step"
            hint="What happens next, with nobody assigned. Anything with an owner and a deadline belongs below as an action item."
            placeholder="e.g. Reconvene after the budget review"
            addLabel="Add next step"
            icon={<ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
            values={nextSteps}
            onChange={setNextSteps}
            disabled={isSaving}
          />

          <div className="flex flex-wrap gap-2">
            {/* Weights swapped. Save was the solid navy one and Publish — the
                act that emails a record you cannot recall — was the pale
                secondary, the same weight as "Add action item". */}
            <button
              onClick={handleSaveMinutes}
              disabled={isSaving || !isDirty}
              className="rounded-2xl border border-border bg-background px-4 py-3 font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : isDirty ? 'Save draft' : 'Saved'}
            </button>
            {minutes && minutes.status === 'DRAFT' && (isOrganizer || isCoOrganizer) && (
              <button
                onClick={() => setConfirmingPublish(true)}
                disabled={isSaving || !canPublish || publishNeedsSave}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden="true" /> Send to attendees
              </button>
            )}
          </div>

          {/* Visible text, not only a tooltip on a disabled button — a disabled
              button leaves the tab order, so the reason was unreachable by
              keyboard. */}
          {minutes?.status === 'DRAFT' && (isOrganizer || isCoOrganizer) && (publishNeedsSave || publishBlockedReason) && (
            <p className="text-xs text-muted-foreground">
              {publishNeedsSave
                ? 'Save your draft before sending it.'
                : publishBlockedReason}
            </p>
          )}
        </div>
      )}

        </div>

        {/* Always rendered, even before minutes exist. It used to disappear
            entirely in that case, which read as a missing feature rather than
            a prerequisite — and an action item genuinely cannot exist without
            minutes, since the server resolves one from the other. */}
        <div className="space-y-4 border-t border-border pt-8">
          <h2 className="text-lg font-semibold text-foreground">Action items</h2>

          {!minutes && (
            <p className="rounded-[1.75rem] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Save the minutes first — action items are attached to the record,
              so there has to be one before you can raise any.
            </p>
          )}

          {minutes && (
          <>

          {canEdit && (
            <div className="rounded-[1.75rem] border border-border bg-card p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <label
                    htmlFor="ai-title"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    What needs doing
                  </label>
                  <input
                    id="ai-title"
                    type="text"
                    value={newActionItem.title}
                    onChange={(e) => setNewActionItem((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="What needs to be done"
                    className="mt-1 w-full rounded-2xl border border-border bg-input px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="ai-due"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Due date
                  </label>
                  <input
                    id="ai-due"
                    type="date"
                    value={newActionItem.dueDate}
                    onChange={(e) => setNewActionItem((prev) => ({ ...prev, dueDate: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-border bg-input px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="ai-description"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Description
                </label>
                <textarea
                  id="ai-description"
                  rows={2}
                  value={newActionItem.description}
                  onChange={(e) =>
                    setNewActionItem((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Any detail the owner needs"
                  className="mt-1 w-full rounded-2xl border border-border bg-input px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Three controls that were presented side by side with no
                  stated relationship, leaving the word "Or" in a placeholder to
                  carry the whole model. */}
              <fieldset>
                <legend className="text-xs font-medium text-muted-foreground">
                  Who owns this
                </legend>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Pick someone from the meeting, or type a name and email for
                  anyone else.
                </p>
              <div className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div>
                  <label
                    htmlFor="ai-owner-search"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    From this meeting
                  </label>
                  {/* Picking someone fills the name and email below, so the
                      common case needs no typing and cannot be misspelled. */}
                  <div className="mt-1">
                    <PersonPicker
                      id="ai-owner-search"
                      value={newActionItem.ownerId}
                      valueName={newActionItem.ownerName}
                      // Everyone connected to this meeting — organizer,
                      // co-organizers and invitees — rather than the whole
                      // ministry. Work out of a meeting belongs to someone
                      // who was in it.
                      endpoint={`/api/v1/events/${id}/attendee-candidates`}
                      placeholder="Search the people at this meeting…"
                      // A guest's id is kept here so the picker shows them as
                      // chosen; it is stripped at submit, since the server has
                      // no user row to resolve it against.
                      onChange={(person) =>
                        setNewActionItem((prev) => ({
                          ...prev,
                          ownerId: person?.id ?? null,
                          ownerName: person?.name ?? null,
                          ownerEmail: person?.email ?? '',
                        }))
                      }
                      disabled={isAddingActionItem}
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="ai-owner-name"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Owner name
                  </label>
                  <input
                    id="ai-owner-name"
                    type="text"
                    value={newActionItem.ownerName ?? ''}
                    onChange={(e) =>
                      setNewActionItem((prev) => ({
                        ...prev,
                        ownerName: e.target.value,
                        // Typing over a picked colleague means this is somebody
                        // else, so the account link must not survive it.
                        ownerId: null,
                      }))
                    }
                    placeholder="Someone outside the meeting"
                    className="mt-1 w-full rounded-2xl border border-border bg-input px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="ai-owner-email"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Owner email
                  </label>
                  <input
                    id="ai-owner-email"
                    type="email"
                    value={newActionItem.ownerEmail}
                    onChange={(e) =>
                      setNewActionItem((prev) => ({
                        ...prev,
                        ownerEmail: e.target.value,
                        ownerId: null,
                      }))
                    }
                    placeholder="name@ministry.gov.sl"
                    className="mt-1 w-full rounded-2xl border border-border bg-input px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              </fieldset>

              <p className="text-xs text-muted-foreground">
                An owner without an account is reached by email. An unassigned
                item still appears on the board, but nobody is reminded about it.
              </p>

              <button
                onClick={handleAddActionItem}
                disabled={isAddingActionItem || !newActionItem.title.trim() || !newActionItem.dueDate}
                className="flex items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-2 font-medium text-secondary-foreground disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> {isAddingActionItem ? 'Adding…' : 'Add action item'}
              </button>
            </div>
          )}

          {actionItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing assigned yet. Anything with an owner and a deadline goes
              here — owners get an email on the morning it is due.
            </p>
          ) : (
            <div className="space-y-2">
              {actionItems.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Due{' '}
                      <time dateTime={item.dueDate}>
                        {new Date(item.dueDate).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                        })}
                      </time>
                    </p>
                  </div>
                  <select
                    value={item.status}
                    aria-label={`Status of "${item.title}"`}
                    onChange={(e) => handleUpdateActionStatus(item.id, e.target.value)}
                    className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:min-w-max"
                  >
                    {Object.entries(ACTION_ITEM_STATUS_LABELS).map(([status, label]) => (
                      <option key={status} value={status}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
          </>
          )}
        </div>
      </div>
      {/* The record as recipients will read it, before it is sent to them.
          Publishing emails every attendee and every walk-in and mints a
          permanent link for anyone outside government — and it sat behind a
          bare click, while archiving, which the same person can undo, asked
          for confirmation. */}
      <Modal
        open={confirmingPublish}
        onClose={() => setConfirmingPublish(false)}
        title={
          editPermission
            ? `Send these minutes to ${editPermission.recipients.total} ${editPermission.recipients.total === 1 ? 'person' : 'people'}?`
            : 'Send these minutes?'
        }
        description={
          editPermission && editPermission.recipients.external > 0
            ? `${editPermission.recipients.external} of them are outside government and will get a permanent link. This cannot be unsent.`
            : 'This cannot be unsent. You can still correct the record for two days afterwards.'
        }
        className="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmingPublish(false)}
              className="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Not yet
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {isSaving ? 'Sending…' : 'Send minutes'}
            </button>
          </>
        }
      >
        {minutes && (
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <MinutesRecord points={minutes.points} actionItems={actionItems} />
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
