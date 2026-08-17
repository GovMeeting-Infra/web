'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table2,
  LayoutGrid,
  ClipboardList,
  AlignLeft,
  CalendarDays,
  CircleDot,
  User,
  AlertTriangle,
  PauseCircle,
} from 'lucide-react';
import { apiFetch, messageFor } from '@/lib/api/client';
import { ListSkeleton } from '@/components/ui/skeletons';
import { useCurrentUser } from '@/components/SessionProvider';
import { KanbanBoard } from '@/components/action-items/KanbanBoard';
import { ActionItemModal } from '@/components/action-items/ActionItemModal';
import { PageContainer } from '@/components/ui/page-container';
import { Tooltip } from '@/components/ui/tooltip';
import {
  ACTION_ITEM_STATUS_LABELS,
  ACTION_ITEM_STATUS_STYLES,
  ACTION_ITEM_STATUS_DOT,
  isActionItemOverdue,
  type ActionItemStatus,
  type BoardActionItem,
  type CoOrganizerCandidate,
} from '@/lib/types/events';
import { useTransientMessage } from '@/lib/hooks/useTransientMessage';

/** Roles that may move any item; everyone else only their own. */
const ADMIN_ROLES = ['SUPER_ADMIN', 'MINISTER', 'MINISTRY_ADMIN'];

const STATUS_OPTIONS: ActionItemStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
];

/** A narrowing toggle. aria-pressed, so its state is not colour alone. */
function FilterChip({
  on,
  onClick,
  label,
  icon,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
        on
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

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

  /**
   * The board is the page's own shape on a desktop; a phone opens the list.
   *
   * The board's only interaction is dragging, and on a phone the card you can
   * drag is your own — so a finger on your own card started a status change
   * instead of scrolling, and touch-action stopped the browser scrolling it
   * either way. The list does the same job there with a per-row control and no
   * dragging at all. Read once, so switching afterwards sticks.
   */
  const [view, setView] = useState<'board' | 'table'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
      ? 'table'
      : 'board',
  );
  // Seeded from ?owner= so a link that promised one person's items opens on
  // them. The dashboard sends people here from counts that are explicitly
  // theirs; landing on the whole ministry's board made them re-filter every
  // time. Still ordinary state afterwards — the picker below owns it, and the
  // URL is not rewritten as they change it.
  const searchParams = useSearchParams();
  /**
   * Defaults to your own items.
   *
   * The page opened on the whole ministry, so the common arrival — "what do I
   * owe" — began by filtering. Overseeing everyone is the rarer job and is one
   * click away in the same control. An explicit ?owner= still wins, so a link
   * that promised one person's list opens on them.
   */
  const [owner, setOwner] = useState(
    () => searchParams.get('owner') ?? currentUser?.id ?? '',
  );
  // An id, not the item. Storing the object meant every write replaced it with
  // whatever the PATCH returned — and the detail view reads
  // item.minutes.event.title, which a bare update result does not carry, so the
  // next render threw. Deriving from the list keeps one source of truth and
  // makes the open item update itself when the query refetches.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useTransientMessage();
  /** Narrowing, not searching: the two questions people actually arrive with. */
  const [onlyLate, setOnlyLate] = useState(false);
  const [onlyBlocked, setOnlyBlocked] = useState(false);

  // ?item= opens one item directly, so a notification about a single task can
  // land on that task. Every action-item notification used to link at the bare
  // board and leave the reader to find the thing they had just been told about.
  const requestedItemId = searchParams.get('item');
  // Consumed once: after the item has been opened, reopening it on every
  // re-render would fight the close button.
  const [openedFromUrl, setOpenedFromUrl] = useState(false);

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

  const mine = (i: BoardActionItem) =>
    !!currentUser && i.ownerId === currentUser.id;

  /**
   * What the page is actually asked, rather than what it used to answer.
   *
   * The header carried three column totals that the columns themselves already
   * showed 200px below. What nobody could see was the only urgent question —
   * how much of mine is late — so finding two overdue items among sixty meant
   * reading every card.
   */
  const lateCount = items.filter(isActionItemOverdue).length;
  const myLateCount = items.filter((i) => mine(i) && isActionItemOverdue(i)).length;
  const blockedCount = items.filter((i) => i.status === 'BLOCKED').length;

  // Cancelled is counted apart from done rather than inside it: closed without
  // the work happening is not the same as finished, and folding them together
  // inflated the figure anyone would quote upward.
  const counts = {
    todo: 0,
    inProgress: 0,
    done: 0,
    cancelled: 0,
  };

  const visible = items.filter(
    (i) =>
      (!onlyLate || isActionItemOverdue(i)) &&
      (!onlyBlocked || i.status === 'BLOCKED'),
  );

  for (const i of visible) {
    if (i.status === 'TODO' || i.status === 'BLOCKED') counts.todo += 1;
    else if (i.status === 'IN_PROGRESS') counts.inProgress += 1;
    else if (i.status === 'COMPLETED') counts.done += 1;
    else if (i.status === 'CANCELLED') counts.cancelled += 1;
  }


  // Mirrors the server: assigned owner, whoever raised the item, or a
  // ministry-level admin. The creator matters because an unassigned item would
  // otherwise be untouchable by the person who just added it.
  const canChange = (item: BoardActionItem) =>
    isAdmin ||
    (!!currentUser &&
      (item.ownerId === currentUser.id ||
        item.assignedBy?.id === currentUser.id));

  /** Helping with it, which allows status and progress and nothing else. */
  const isAssistant = (item: BoardActionItem) =>
    !!currentUser &&
    !!item.assistants?.some((a) => a.userId === currentUser.id);

  /**
   * One PATCH, returning the updated item so the open modal reflects the
   * change without waiting for the list query to come back.
   */
  const patchItem = async (id: string, patch: Record<string, unknown>) => {
    const updated = await apiFetch<BoardActionItem>(
      `/api/v1/action-items/${id}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    );
    await queryClient.invalidateQueries({ queryKey: ['action-items'] });
    return updated;
  };

  /**
   * The item the modal is showing: an explicit click, or the one named in the
   * URL until it has been closed once.
   *
   * Derived at render rather than pushed into state from an effect — setting
   * state in an effect is what react-hooks/set-state-in-effect exists to catch,
   * and the list arrives asynchronously so an effect would need to re-run and
   * would then reopen the modal every time the query refetched.
   */
  const openId = selectedId ?? (openedFromUrl ? null : requestedItemId);
  const activeItem = openId ? (items.find((i) => i.id === openId) ?? null) : null;

  const changeStatus = async (item: BoardActionItem, status: ActionItemStatus) => {
    setError(null);
    try {
      await apiFetch(`/api/v1/action-items/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
    } catch (err) {
      setError(
        messageFor(
          err,
          `"${item.title}" is still in ${ACTION_ITEM_STATUS_LABELS[item.status]} — the change didn't save. Try again.`,
        ),
      );
      // Rethrown so the board can correct what it announced.
      throw err;
    }
  };

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-success">
            From your meetings
          </p>
          <h1 className="text-3xl font-bold text-primary">Action items</h1>
          {/* The three counts, coloured to the board so a number means the
              same thing whichever view you came from. Cancelled sits apart from
              done rather than inside it. */}
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
            <Tooltip content="Not started, plus anything on hold — a task waiting on someone else still has to be done.">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${ACTION_ITEM_STATUS_DOT.TODO}`}
                />
                {counts.todo} to do
              </span>
            </Tooltip>
                          <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${ACTION_ITEM_STATUS_DOT.IN_PROGRESS}`}
                />
                {counts.inProgress} in progress
              </span>
            
            <Tooltip content="Finished. Cancelled items are counted separately.">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${ACTION_ITEM_STATUS_DOT.COMPLETED}`}
                />
                {counts.done} done
              </span>
            </Tooltip>
            {counts.cancelled > 0 && (
              <Tooltip content="Closed without the work happening.">
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${ACTION_ITEM_STATUS_DOT.CANCELLED}`}
                  />
                  {counts.cancelled} cancelled
                </span>
              </Tooltip>
            )}
          </p>

          {/* Alongside the counts, not instead of them: the counts say what the
              board holds, this says what needs you today. */}
          {myLateCount > 0 && (
            <p className="mt-1">
              <button
                type="button"
                onClick={() => {
                  if (currentUser) setOwner(currentUser.id);
                  setOnlyLate(true);
                }}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-alert-fg underline underline-offset-4"
              >
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                {myLateCount === 1
                  ? '1 of yours is late'
                  : `${myLateCount} of yours are late`}
              </button>
            </p>
          )}
        </div>

        {/* Outside the length guard. Inside it, filtering to a colleague who
            owns nothing unmounted the very control that produced the filter,
            leaving no way back except editing the URL. */}
        <div className="flex flex-wrap items-center gap-3">
            {people.length > 0 && (
              <>
              <label htmlFor="owner-filter" className="sr-only">
                Show items assigned to
              </label>
              <select
                id="owner-filter"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                // Options fall back to the full email when a person has no
                // name, which sizes this control to ~280px and pushes it off
                // the screen. Same fix as the activity log and users filters.
                className="min-w-0 max-w-full truncate rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary sm:max-w-[14rem]"
              >
                <option value="">Everyone</option>
                {currentUser && <option value={currentUser.id}>Only mine</option>}
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name ?? p.email}
                  </option>
                ))}
              </select>
              </>
            )}

            {/* The two questions people arrive with, and the one the board
                cannot otherwise express. */}
            {lateCount > 0 && (
              <FilterChip
                on={onlyLate}
                onClick={() => setOnlyLate((v) => !v)}
                label={`Late (${lateCount})`}
                icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            )}
            {blockedCount > 0 && (
              <FilterChip
                on={onlyBlocked}
                onClick={() => setOnlyBlocked((v) => !v)}
                label={`On hold (${blockedCount})`}
                icon={<PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            )}

            <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
              <Tooltip content="Every item in one list, with its meeting, owner and due date side by side.">
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
              </Tooltip>
              <Tooltip content="Three columns by status. Drag a card across, or use the arrow keys, to move the work along.">
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
              </Tooltip>
            </div>
        </div>
      </div>

      {(error || loadError) && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error ??
            (loadError instanceof Error
              ? loadError.message
              : "We couldn't load your action items. Check your connection and try again.")}
        </div>
      )}

      {isLoading && (
        <ListSkeleton rows={6} label="Loading action items" />
      )}

      {!isLoading && visible.length === 0 && (
        <div className="rounded-[1.5rem] border border-border bg-card p-12 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
          {/* Narrowed to nothing is not the same as having nothing, and the
              page used to say the second when it meant the first. */}
          {items.length > 0 ? (
            <>
              <p className="mt-4 font-medium text-foreground">
                Nothing matches what you have narrowed to
              </p>
              <button
                type="button"
                onClick={() => {
                  setOnlyLate(false);
                  setOnlyBlocked(false);
                  setOwner('');
                }}
                className="mt-4 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Show everything
              </button>
            </>
          ) : (
            <>
              <p className="mt-4 font-medium text-foreground">Nothing assigned yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Action items come out of meeting minutes — open a meeting&rsquo;s
                minutes to raise one.
              </p>
              <Link
                href="/administrative/minutes"
                className="mt-5 inline-flex items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Go to minutes
              </Link>
            </>
          )}
        </div>
      )}

      {!isLoading && visible.length > 0 && view === 'board' && (
        <KanbanBoard
          items={visible}
          canDragItem={canChange}
          onOpen={(item) => setSelectedId(item.id)}
          onMove={changeStatus}
        />
      )}

      {!isLoading && visible.length > 0 && view === 'table' && (
        /* Laid out the way a Notion database table is: no card around it, a
           hairline under the header, thin separators between columns, and rows
           that only shade on hover. The chrome recedes so the data reads. */
        <div>
          {/* Five columns need 768px. Below sm the same rows render as cards
              instead — a phone can scroll a table sideways but cannot tell you
              which row it has ended up in. */}
          <div className="-mx-1 hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[48rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    { icon: AlignLeft, label: 'Task' },
                    { icon: ClipboardList, label: 'Event' },
                    { icon: User, label: 'Assignee' },
                    { icon: CalendarDays, label: 'Due' },
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
                {visible.map((item) => {
                  const overdue = isActionItemOverdue(item);
                  const ownerName = item.owner?.name ?? item.ownerName;

                  return (
                    <tr
                      key={item.id}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedId(item.id);
                        }
                      }}
                      onClick={() => setSelectedId(item.id)}
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
                          <span className="text-muted-foreground">Unassigned</span>
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
                            className={`cursor-pointer appearance-none rounded px-2 py-0.5 text-[11px] font-medium ${
                              ACTION_ITEM_STATUS_STYLES[item.status]
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
                            className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${ACTION_ITEM_STATUS_STYLES[item.status]}`}
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
          </div>

          <ul className="space-y-2 sm:hidden">
            {visible.map((item) => {
              const overdue = isActionItemOverdue(item);
              const ownerName = item.owner?.name ?? item.ownerName;

              return (
                <li
                  key={item.id}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedId(item.id);
                    }
                  }}
                  onClick={() => setSelectedId(item.id)}
                  className="cursor-pointer space-y-2 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/40"
                >
                  <p className="font-medium text-foreground">{item.title}</p>

                  <p className="text-xs text-muted-foreground">
                    {item.minutes.event.title}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                    {ownerName ? (
                      <span className="flex items-center gap-1.5 text-foreground">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
                          {initials(ownerName)}
                        </span>
                        {ownerName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">Unassigned</span>
                    )}

                    <span
                      className={
                        overdue
                          ? 'font-medium text-destructive'
                          : 'text-muted-foreground'
                      }
                    >
                      {new Date(item.dueDate).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {overdue ? ' · Overdue' : ''}
                    </span>
                  </div>

                  {/* Stop propagation so using the select doesn't open the modal */}
                  <div
                    className="flex flex-wrap items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canChange(item) ? (
                      // text-base, unlike the table's 11px: Safari zooms the
                      // whole page when a control under 16px takes focus.
                      <select
                        value={item.status}
                        onChange={(e) =>
                          changeStatus(item, e.target.value as ActionItemStatus)
                        }
                        aria-label="Status"
                        className={`cursor-pointer appearance-none rounded px-2 py-1 text-base font-medium ${
                          ACTION_ITEM_STATUS_STYLES[item.status]
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
                        className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${ACTION_ITEM_STATUS_STYLES[item.status]}`}
                      >
                        {ACTION_ITEM_STATUS_LABELS[item.status]}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Notion closes a table with its row count. Outside the scroller, or
              it drifts off-screen along with the columns. */}
          <p className="px-3 py-2 text-[13px] text-muted-foreground">
            {visible.length} {visible.length === 1 ? 'item' : 'items'}
          </p>
        </div>
      )}

      {activeItem && (
        <ActionItemModal
          item={activeItem}
          onClose={() => {
            setSelectedId(null);
            setOpenedFromUrl(true);
          }}
          onSaveProgress={
            // Assistants too. The server's permitted set is status,
            // progressNotes and progressLink (action-items.service.ts), so
            // someone helping with a task was allowed to report where it had
            // got to and was never shown the box to do it in — while the
            // status control beside it, governed by the same rule, was offered.
            canChange(activeItem) || isAssistant(activeItem)
              ? async (notes, link) => {
                  await apiFetch(`/api/v1/action-items/${activeItem.id}`, {
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
            canChange(activeItem)
              ? async (person) => {
                  // A guest has no user row to point at, so they are assigned
                  // by address instead. The endpoint marks them with a guest:
                  // prefix precisely so this can tell the two apart.
                  const isGuest = person?.id.startsWith('guest:') ?? false;
                  await apiFetch(`/api/v1/action-items/${activeItem.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(
                      isGuest
                        ? { ownerEmail: person!.email, ownerName: person!.name }
                        : { ownerId: person?.id ?? null },
                    ),
                  });
                  await queryClient.invalidateQueries({
                    queryKey: ['action-items'],
                  });
                  setSelectedId(null);
                }
              : undefined
          }
          // Separate from onEdit deliberately: an assistant may move the
          // status and report progress but not redefine the task, and the
          // server enforces exactly that split.
          onStatusChange={
            canChange(activeItem) || isAssistant(activeItem)
              ? async (status) => {
                  await patchItem(activeItem.id, { status });
                }
              : undefined
          }
          onEdit={
            canChange(activeItem)
              ? async (patch) => {
                  await patchItem(activeItem.id, patch);
                }
              : undefined
          }
          onAddAssistant={
            canChange(activeItem)
              ? async (person) => {
                  await apiFetch(
                    `/api/v1/action-items/${activeItem.id}/assistants`,
                    {
                      method: 'POST',
                      body: JSON.stringify({ userId: person.id }),
                    },
                  );
                  await queryClient.invalidateQueries({
                    queryKey: ['action-items'],
                  });
                }
              : undefined
          }
          onRemoveAssistant={
            canChange(activeItem)
              ? async (userId) => {
                  await apiFetch(
                    `/api/v1/action-items/${activeItem.id}/assistants/${userId}`,
                    { method: 'DELETE' },
                  );
                  await queryClient.invalidateQueries({
                    queryKey: ['action-items'],
                  });
                }
              : undefined
          }
        />
      )}
    </PageContainer>
  );
}
