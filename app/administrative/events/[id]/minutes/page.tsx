'use client';

import { use, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Send, Plus, Archive, Lock } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useCurrentUser } from '@/components/SessionProvider';
import { PersonPicker } from '@/components/ui/person-picker';
import { ACTION_ITEM_STATUS_LABELS, type EventDetail, type Minutes, type ActionItem } from '@/lib/types/events';

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
    dueDate: string;
    ownerId: string | null;
    ownerName: string | null;
  }>({ title: '', dueDate: '', ownerId: null, ownerName: null });
  const [isAddingActionItem, setIsAddingActionItem] = useState(false);

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
          ownerId: newActionItem.ownerId ?? undefined,
        }),
      });
      setNewActionItem({ title: '', dueDate: '', ownerId: null, ownerName: null });
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
    <div className="mx-auto max-w-4xl space-y-8 p-8">
      <Link href={`/administrative/events/${id}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Event
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-primary">Meeting Minutes</h1>
        {minutes && <p className="mt-2 text-sm text-muted-foreground">Status: {minutes.status}</p>}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {isReadOnlyView && minutes && (
        <div className="space-y-4 rounded-[1.75rem] border border-border bg-card p-8">
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
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
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
        <div className="space-y-3 rounded-[1.75rem] border border-border bg-card p-8">
          <p className="text-sm text-muted-foreground">
            These minutes are read-only for you — the edit window has closed or you
            aren&apos;t an organizer.
          </p>
          {minutes?.body && (
            <p className="whitespace-pre-wrap text-sm text-foreground">{minutes.body}</p>
          )}
        </div>
      )}

      {canEdit && (
        <div className="space-y-4 rounded-[1.75rem] border border-border bg-card p-8">
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

          <div className="flex gap-2">
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

      {minutes && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Action Items</h2>

          {canEdit && (
            <div className="rounded-[1.75rem] border border-border bg-card p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
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
                  Assign to (optional)
                </label>
                <PersonPicker
                  value={newActionItem.ownerId}
                  valueName={newActionItem.ownerName}
                  onChange={(person) =>
                    setNewActionItem((prev) => ({
                      ...prev,
                      ownerId: person?.id ?? null,
                      ownerName: person?.name ?? null,
                    }))
                  }
                  disabled={isAddingActionItem}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  An unassigned item still appears on the board, but nobody is
                  reminded about it.
                </p>
              </div>

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
                <div key={item.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">Due: {new Date(item.dueDate).toLocaleDateString()}</p>
                  </div>
                  <select
                    value={item.status}
                    onChange={(e) => handleUpdateActionStatus(item.id, e.target.value)}
                    className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-w-max"
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
        </div>
      )}
    </div>
  );
}
