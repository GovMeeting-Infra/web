'use client';

import { use, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Send, Plus, Archive, Lock, RotateCcw } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useCurrentUser } from '@/components/SessionProvider';
import { PersonPicker } from '@/components/ui/person-picker';
import { ACTION_ITEM_STATUS_LABELS, type EventDetail, type Minutes, type ActionItem } from '@/lib/types/events';
import { PageContainer } from '@/components/ui/page-container';

export default function MinutesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const [body, setBody] = useState('');
  const [summary, setSummary] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const { data: event } = useQuery({
    queryKey: ['event', id],
    queryFn: () => apiFetch<EventDetail>(`/api/v1/events/${id}`),
  });

  const { data: minutes } = useQuery({
    queryKey: ['minutes', id],
    queryFn: async () => {
      try {
        return await apiFetch<Minutes>(`/api/v1/events/${id}/minutes`);
      } catch {
        return null;
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

  // Seed the editor once the saved minutes arrive, so the fields stay freely
  // editable afterwards (including clearing them).
  useEffect(() => {
    if (minutes) {
      setBody(minutes.body ?? '');
      setSummary(minutes.summary ?? '');
    }
  }, [minutes]);

  // The 2-day edit window and its ministry-admin override live on the server;
  // ask rather than re-deriving them here.
  const { data: editPermission } = useQuery({
    queryKey: ['minutes-can-edit', id],
    queryFn: () =>
      apiFetch<{ canEdit: boolean }>(`/api/v1/events/${id}/minutes/can-edit`),
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

  // Same roles the server allows to archive and restore. The server is still
  // the authority; this only decides whether to offer the control.
  const canManageArchive =
    currentUser?.systemRole === 'MINISTER' || isSuperAdmin;

  const handleArchiveToggle = async () => {
    const restoring = isArchived;
    if (
      !restoring &&
      !window.confirm(
        'Archive these minutes? The record becomes permanent — nobody will be able to edit it, and only ministers and super admins will be able to read it.',
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
        err instanceof Error
          ? err.message
          : `Could not ${restoring ? 'restore' : 'archive'} these minutes.`,
      );
    } finally {
      setIsArchiving(false);
    }
  };

  // Server rejects publishing without a body or without at least one attendee
  // (minutes.service.ts publishMinutes), so mirror both preconditions here.
  const isOrganizer = !!currentUser && currentUser.id === event?.organizerId;
  const isCoOrganizer =
    !!currentUser && !!event?.coOrganizers.some((c) => c.userId === currentUser.id);
  const hasAttendees = (event?.attendees.length ?? 0) > 0;
  const canPublish = (isOrganizer || isCoOrganizer) && !!body.trim() && hasAttendees;
  const publishBlockedReason = !hasAttendees
    ? 'This event has no attendees yet.'
    : !body.trim()
      ? 'Add minutes content before publishing.'
      : null;

  const handleSaveMinutes = async () => {
    if (!body.trim() && !minutes) {
      setError('Minutes body cannot be empty');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      if (minutes) {
        await apiFetch(`/api/v1/events/${id}/minutes`, {
          method: 'PATCH',
          body: JSON.stringify({ body, summary: summary || undefined }),
        });
      } else {
        await apiFetch(`/api/v1/events/${id}/minutes`, {
          method: 'POST',
          body: JSON.stringify({ body, summary: summary || undefined }),
        });
      }
      queryClient.invalidateQueries({ queryKey: ['minutes', id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save minutes');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
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
      setError(err instanceof Error ? err.message : 'Failed to add action item');
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
      setError(err instanceof Error ? err.message : 'Failed to update action item');
    }
  };

  return (
    <PageContainer className="space-y-8">
      <Link href={`/administrative/events/${id}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Event
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">Meeting Minutes</h1>
          {minutes && <p className="mt-2 text-sm text-muted-foreground">Status: {minutes.status}</p>}
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
              ? 'Working…'
              : isArchived
                ? 'Restore from archive'
                : 'Archive record'}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
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
              : 'You are viewing a published record. Editing is left to the organizing team.'}
          </p>

          {minutes.summary && (
            <p className="text-sm font-medium text-foreground">{minutes.summary}</p>
          )}
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {minutes.body}
          </p>

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

      {!canEdit && !isReadOnlyView && (
        <div className="space-y-3 rounded-[1.75rem] border border-border bg-card p-8 max-sm:p-4">
          <p className="text-sm text-muted-foreground">
            These minutes are read-only for you — the edit window has closed or you
            aren&apos;t an organizer.
          </p>
          {minutes?.body && (
            <p className="whitespace-pre-wrap break-words text-sm text-foreground">{minutes.body}</p>
          )}
        </div>
      )}

      {canEdit && (
        <div className="space-y-4 rounded-[1.75rem] border border-border bg-card p-8 max-sm:p-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Body</label>
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter the meeting minutes..."
              className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Summary</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief summary (optional)"
              className="w-full rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSaveMinutes}
              disabled={isSaving}
              className="flex-1 rounded-2xl bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-50"
            >
              Save Minutes
            </button>
            {minutes && minutes.status === 'DRAFT' && (isOrganizer || isCoOrganizer) && (
              <button
                onClick={handlePublish}
                disabled={isSaving || !canPublish}
                title={publishBlockedReason ?? 'Publish these minutes'}
                className="flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 font-medium text-secondary-foreground disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> Publish
              </button>
            )}
          </div>

          {minutes?.status === 'DRAFT' && (isOrganizer || isCoOrganizer) && publishBlockedReason && (
            <p className="text-xs text-muted-foreground">
              Can&apos;t publish yet: {publishBlockedReason}
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
          <h2 className="text-lg font-semibold text-foreground">Action Items</h2>

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
                  <label className="text-xs font-medium text-muted-foreground">
                    Action
                  </label>
                  <input
                    type="text"
                    value={newActionItem.title}
                    onChange={(e) => setNewActionItem((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="What needs to be done"
                    className="mt-1 w-full rounded-2xl border border-border bg-input px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={newActionItem.dueDate}
                    onChange={(e) => setNewActionItem((prev) => ({ ...prev, dueDate: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-border bg-input px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newActionItem.description}
                  onChange={(e) =>
                    setNewActionItem((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Any detail the owner needs"
                  className="mt-1 w-full rounded-2xl border border-border bg-input px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Assign to a colleague
                  </label>
                  {/* Picking someone fills the name and email below, so the
                      common case needs no typing and cannot be misspelled. */}
                  <div className="mt-1">
                    <PersonPicker
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
                  <label className="text-xs font-medium text-muted-foreground">
                    Owner name
                  </label>
                  <input
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
                    placeholder="Or type a name"
                    className="mt-1 w-full rounded-2xl border border-border bg-input px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Owner email
                  </label>
                  <input
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
            <p className="text-muted-foreground">No action items yet.</p>
          ) : (
            <div className="space-y-2">
              {actionItems.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">Due: {new Date(item.dueDate).toLocaleDateString()}</p>
                  </div>
                  <select
                    value={item.status}
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
    </PageContainer>
  );
}
