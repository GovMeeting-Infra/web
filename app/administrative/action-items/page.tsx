'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table2,
  LayoutGrid,
  ClipboardList,
  AlignLeft,
  CalendarDays,
  CircleDot,
  User,
  Tag,
} from 'lucide-react';
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

/**
 * Notion's select-property palette: a soft tint with dark text of the same hue,
 * rather than the saturated badge colours used elsewhere in the app. Muted
 * enough that a column of them reads as data, not as a row of warnings.
 */
const STATUS_PILL: Record<ActionItemStatus, string> = {
  TODO: 'bg-[#f1f1ef] text-[#32302c]',
  IN_PROGRESS: 'bg-[#e7f3f8] text-[#183347]',
  BLOCKED: 'bg-[#fdebec] text-[#5d1715]',
  COMPLETED: 'bg-[#edf3ec] text-[#1c3829]',
  CANCELLED: 'bg-[#f1f1ef] text-[#787774]',
};

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

  const [view, setView] = useState<'board' | 'table'>('table');
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
        /* Laid out the way a Notion database table is: no card around it, a
           hairline under the header, thin separators between columns, and rows
           that only shade on hover. The chrome recedes so the data reads. */
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                {[
                  { icon: AlignLeft, label: 'Task' },
                  { icon: ClipboardList, label: 'Event' },
                  { icon: User, label: 'Assignee' },
                  { icon: CalendarDays, label: 'Due' },
                  { icon: Tag, label: 'Type' },
                  { icon: CircleDot, label: 'Status' },
                ].map(({ icon: Icon, label }, i) => (
                  <th
                    key={label}
                    className={`px-3 py-2 text-left text-[13px] font-normal text-muted-foreground ${
                      i > 0 ? 'border-l border-border' : ''
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon aria-hidden className="h-3.5 w-3.5 opacity-70" />
                      {label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const overdue = isActionItemOverdue(item);
                const ownerName = item.owner?.name ?? item.ownerName;

                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className="group cursor-pointer border-b border-border transition-colors hover:bg-muted/40"
                  >
                    <td className="px-3 py-2">
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate text-foreground">
                          {item.title}
                        </span>
                        {/* Notion's hover affordance: the row is clickable, but
                            nothing says so until you are on it. */}
                        <span className="shrink-0 rounded border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                          Open
                        </span>
                      </span>
                    </td>

                    <td className="truncate border-l border-border px-3 py-2 text-muted-foreground">
                      {item.minutes.event.title}
                    </td>

                    <td className="border-l border-border px-3 py-2">
                      {ownerName ? (
                        <span className="flex items-center gap-2 text-foreground">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
                            {initials(ownerName)}
                          </span>
                          <span className="truncate">{ownerName}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">Empty</span>
                      )}
                    </td>

                    <td className="border-l border-border px-3 py-2">
                      <span
                        className={
                          overdue ? 'font-medium text-destructive' : 'text-foreground'
                        }
                      >
                        {new Date(item.dueDate).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {overdue ? ' · Overdue' : ''}
                      </span>
                    </td>

                    <td className="border-l border-border px-3 py-2">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${POINT_STYLES[item.point]}`}
                      >
                        {POINT_LABELS[item.point]}
                      </span>
                    </td>

                    {/* Stop propagation so using the select doesn't open the modal */}
                    <td
                      className="border-l border-border px-3 py-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canChange(item) ? (
                        // Styled as the pill it replaces rather than as a form
                        // control, so the column reads consistently whether or
                        // not you happen to be allowed to change a given row.
                        <select
                          value={item.status}
                          onChange={(e) =>
                            changeStatus(item, e.target.value as ActionItemStatus)
                          }
                          className={`cursor-pointer appearance-none rounded px-2 py-0.5 text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                            STATUS_PILL[item.status]
                          }`}
                        >
                          {STATUS_OPTIONS.map((st) => (
                            <option key={st} value={st}>
                              {ACTION_ITEM_STATUS_LABELS[st]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${STATUS_PILL[item.status]}`}
                        >
                          {ACTION_ITEM_STATUS_LABELS[item.status]}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Notion closes a table with its row count. */}
          <p className="px-3 py-2 text-[13px] text-muted-foreground">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </p>
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
