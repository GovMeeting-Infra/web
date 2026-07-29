'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Table2, LayoutGrid, ClipboardList } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { ListSkeleton } from '@/components/ui/skeletons';
import { useCurrentUser } from '@/components/SessionProvider';
import { KanbanBoard } from '@/components/action-items/KanbanBoard';
import { ActionItemModal } from '@/components/action-items/ActionItemModal';
import {
  ACTION_ITEM_STATUS_LABELS,
  POINT_LABELS,
  POINT_STYLES,
  isActionItemOverdue,
  type ActionItemStatus,
  type BoardActionItem,
  type CoOrganizerCandidate,
} from '@/lib/types/events';

/** Roles that may move any item; everyone else only their own. */
const ADMIN_ROLES = ['SUPER_ADMIN', 'MINISTER', 'MINISTRY_ADMIN'];

const STATUS_OPTIONS: ActionItemStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
];

function initials(name?: string | null) {
  if (!name) return '—';
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default function ActionItemsPage() {
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();

  const [view, setView] = useState<'board' | 'table'>('board');
  const [owner, setOwner] = useState('');
  const [selected, setSelected] = useState<BoardActionItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = !!currentUser && ADMIN_ROLES.includes(currentUser.systemRole);

  const { data: items = [], isLoading, error: loadError } = useQuery({
    queryKey: ['action-items', owner],
    queryFn: () =>
      apiFetch<BoardActionItem[]>(
        `/api/v1/action-items${owner ? `?owner=${encodeURIComponent(owner)}` : ''}`,
      ),
  });

  // Ministry colleagues, reusing the picker list added for the event form.
  const { data: people = [] } = useQuery({
    queryKey: ['co-organizer-candidates'],
    queryFn: () =>
      apiFetch<CoOrganizerCandidate[]>('/api/v1/events/co-organizer-candidates'),
  });

  const counts = {
    todo: items.filter((i) => i.status === 'TODO' || i.status === 'BLOCKED').length,
    inProgress: items.filter((i) => i.status === 'IN_PROGRESS').length,
    done: items.filter((i) => i.status === 'COMPLETED' || i.status === 'CANCELLED')
      .length,
  };

  // Mirrors the server: assigned owner, whoever raised the item, or a
  // ministry-level admin. The creator matters because an unassigned item would
  // otherwise be untouchable by the person who just added it.
  const canChange = (item: BoardActionItem) =>
    isAdmin ||
    (!!currentUser &&
      (item.ownerId === currentUser.id ||
        item.assignedBy?.id === currentUser.id));

  const changeStatus = async (item: BoardActionItem, status: ActionItemStatus) => {
    setError(null);
    try {
      await apiFetch(`/api/v1/action-items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Couldn't update "${item.title}".`);
    }
  };

  return (
    <div className="w-full space-y-6 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-ring">
            Task board
          </p>
          <h1 className="text-3xl font-bold text-primary">Action Items</h1>
          <p className="mt-2 text-muted-foreground">
            {counts.todo} to do · {counts.inProgress} in progress · {counts.done} done
          </p>
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {people.length > 0 && (
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All assignees</option>
                {currentUser && <option value={currentUser.id}>Assigned to me</option>}
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name ?? p.email}
                  </option>
                ))}
              </select>
            )}

            <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
              <button
                onClick={() => setView('table')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === 'table'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary/50'
                }`}
              >
                <Table2 className="h-3.5 w-3.5" /> Table
              </button>
              <button
                onClick={() => setView('board')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === 'board'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-secondary/50'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Board
              </button>
            </div>
          </div>
        )}
      </div>

      {(error || loadError) && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error ??
            (loadError instanceof Error
              ? loadError.message
              : 'Failed to load action items')}
        </div>
      )}

      {isLoading && (
        <ListSkeleton rows={6} label="Loading action items" />
      )}

      {!isLoading && items.length === 0 && (
        <div className="rounded-[1.5rem] border border-border bg-card p-12 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 font-medium text-foreground">No action items yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Action items are created from meeting minutes.
          </p>
        </div>
      )}

      {!isLoading && items.length > 0 && view === 'board' && (
        <KanbanBoard
          items={items}
          canDragItem={canChange}
          onOpen={setSelected}
          onMove={changeStatus}
        />
      )}

      {!isLoading && items.length > 0 && view === 'table' && (
        <div className="overflow-x-auto rounded-[1.5rem] border border-border bg-card">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Timeline</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const overdue = isActionItemOverdue(item);
                const ownerName = item.owner?.name ?? item.ownerName;

                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={`cursor-pointer border-b border-border transition-colors hover:bg-muted/40 ${
                      i % 2 === 1 ? 'bg-muted/10' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {item.title}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.minutes.event.title}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
                          {initials(ownerName)}
                        </span>
                        {ownerName ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          overdue
                            ? 'font-semibold text-destructive'
                            : 'text-muted-foreground'
                        }
                      >
                        {new Date(item.dueDate).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                        })}
                        {overdue ? ' · Overdue' : ''}
                      </span>
                    </td>
                    {/* Stop propagation so using the select doesn't open the modal */}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${POINT_STYLES[item.point]}`}
                        >
                          {POINT_LABELS[item.point]}
                        </span>
                        <select
                          value={item.status}
                          disabled={!canChange(item)}
                          onChange={(e) =>
                            changeStatus(item, e.target.value as ActionItemStatus)
                          }
                          className="rounded-lg border border-border bg-input px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none disabled:opacity-50"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {ACTION_ITEM_STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <ActionItemModal
          item={selected}
          onClose={() => setSelected(null)}
          onSaveProgress={
            canChange(selected)
              ? async (notes, link) => {
                  await apiFetch(`/api/v1/action-items/${selected.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                      progressNotes: notes,
                      progressLink: link,
                    }),
                  });
                  queryClient.invalidateQueries({ queryKey: ['action-items'] });
                }
              : undefined
          }
          onReassign={
            canChange(selected)
              ? async (ownerId) => {
                  await apiFetch(`/api/v1/action-items/${selected.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ ownerId }),
                  });
                  await queryClient.invalidateQueries({
                    queryKey: ['action-items'],
                  });
                  setSelected(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
