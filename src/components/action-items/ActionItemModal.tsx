'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Modal } from '@/components/ui/modal';
import { useTransientMessage } from '@/lib/hooks/useTransientMessage';
import {
  X,
  CalendarDays,
  User,
  UserCheck,
  UserPlus,
  Users,
  CircleDot,
  Flag,
  FileText,
} from 'lucide-react';
import {
  PersonPicker,
  type DirectoryPerson,
} from '@/components/ui/person-picker';
import {
  ACTION_ITEM_STATUS_LABELS,
  ACTION_ITEM_STATUS_STYLES,
  ACTION_ITEM_PRIORITY_LABELS,
  isActionItemOverdue,
  type ActionItemStatus,
  type BoardActionItem,
} from '@/lib/types/events';

const STATUS_OPTIONS: ActionItemStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
];

function Field({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Detail view, in the shared Modal — which owns the focus trap, Escape, focus
 * restore and scroll lock.
 *
 * The assignee is editable when `onReassign` is supplied; the caller decides
 * whether this user may reassign, since the server is the real authority.
 */
export function ActionItemModal({
  item,
  onClose,
  onReassign,
  onSaveProgress,
  onEdit,
  onStatusChange,
  onAddAssistant,
  onRemoveAssistant,
}: {
  item: BoardActionItem;
  onClose: () => void;
  onReassign?: (person: DirectoryPerson | null) => Promise<void>;
  /** Omitted when the viewer may not record progress — the block turns read-only. */
  onSaveProgress?: (notes: string, link: string) => Promise<void>;
  /**
   * Change the task itself. Omitted for an assistant, who may report on the
   * work but not redefine it — the server refuses either way, this only
   * decides whether to offer the controls.
   */
  onEdit?: (patch: Record<string, unknown>) => Promise<void>;
  /** Separate from onEdit: an assistant may move the status but edit nothing else. */
  onStatusChange?: (status: ActionItemStatus) => Promise<void>;
  onAddAssistant?: (person: DirectoryPerson) => Promise<void>;
  onRemoveAssistant?: (userId: string) => Promise<void>;
}) {
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignError, setReassignError] = useTransientMessage();
  const [notes, setNotes] = useState(item.progressNotes ?? '');
  const [link, setLink] = useState(item.progressLink ?? '');
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [progressError, setProgressError] = useTransientMessage();
  const [description, setDescription] = useState(item.description ?? '');
  const [editError, setEditError] = useTransientMessage();
  const [isAddingHelper, setIsAddingHelper] = useState(false);

  /**
   * Each field saves itself rather than queueing behind one Save button,
   * matching how the assignee picker and the progress block already behave.
   */
  const save = async (patch: Record<string, unknown>) => {
    if (!onEdit) return;
    setEditError(null);
    try {
      await onEdit(patch);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save.');
    }
  };

  const handleReassign = async (person: DirectoryPerson | null) => {
    if (!onReassign) return;
    setIsReassigning(true);
    setReassignError(null);
    try {
      await onReassign(person);
    } catch (err) {
      setReassignError(
        err instanceof Error ? err.message : 'Could not change the assignee.',
      );
    } finally {
      setIsReassigning(false);
    }
  };

  const overdue = isActionItemOverdue(item);
  const dt = (v: string) =>
    new Date(v).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  return (
    // The shared Modal, not another hand-rolled overlay. This one had no focus
    // trap, never moved focus in, never restored it on close, and left the page
    // behind it scrollable — the exact set of defects ui/modal.tsx was written
    // to fix once, for every dialog. It was the fifth.
    <Modal open onClose={onClose} title={item.title} className="max-w-2xl">
      <div>

        {onEdit ? (
          <div className="mt-4">
            <label
              htmlFor="ai-description"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Description
            </label>
            <textarea
              id="ai-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              // On blur, and only when it changed: a save per keystroke would
              // be a request per keystroke.
              onBlur={() => {
                if (description !== (item.description ?? '')) {
                  void save({ description });
                }
              }}
              placeholder="What this involves…"
              className="mt-1 w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary"
            />
          </div>
        ) : (
          item.description && (
            <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
              {item.description}
            </p>
          )
        )}

        {editError && (
          <p className="mt-2 text-xs text-destructive">{editError}</p>
        )}

        <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {onReassign ? (
            <div className="sm:col-span-2">
              <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                Assignee
              </dt>
              <dd>
                <PersonPicker
                  value={item.owner?.id ?? null}
                  valueName={item.owner?.name ?? item.ownerName ?? null}
                  onChange={handleReassign}
                  // This meeting's invitees, not the whole ministry: work
                  // coming out of a meeting belongs to somebody who was in it.
                  endpoint={`/api/v1/events/${item.minutes.event.id}/attendee-candidates`}
                  placeholder="Search the people invited to this meeting…"
                  disabled={isReassigning}
                />
                {reassignError && (
                  <p className="mt-1 text-xs text-destructive">
                    {reassignError}
                  </p>
                )}
              </dd>
            </div>
          ) : (
            <Field
              icon={<User className="h-3.5 w-3.5" />}
              label="Assignee"
              value={
                <span>
                  {item.owner?.name ?? item.ownerName ?? 'Unassigned'}
                  {/* No account behind this name, so the address is the only
                      way anyone can reach them. */}
                  {!item.owner && item.ownerEmail && (
                    <span className="block text-xs font-normal text-muted-foreground">
                      {item.ownerEmail}
                    </span>
                  )}
                </span>
              }
            />
          )}
          <Field
            icon={<UserCheck className="h-3.5 w-3.5" />}
            label="Assigned by"
            value={item.assignedBy?.name ?? '—'}
          />
          {onEdit ? (
            <div>
              <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Due
              </dt>
              <dd className="mt-1">
                <input
                  type="date"
                  value={item.dueDate.slice(0, 10)}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    // Moving the date clears the reminder stamp server-side,
                    // so a rescheduled item gets chased again.
                    void save({
                      dueDate: new Date(e.target.value).toISOString(),
                    });
                  }}
                  className={`w-full rounded-xl border border-border bg-input px-3 py-2 text-sm focus:border-primary ${
                    overdue ? 'text-destructive' : 'text-foreground'
                  }`}
                />
                {overdue && (
                  <p className="mt-1 text-xs font-medium text-destructive">
                    Overdue
                  </p>
                )}
              </dd>
            </div>
          ) : (
            <Field
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="Timeline"
              value={
                <span
                  className={overdue ? 'font-semibold text-destructive' : ''}
                >
                  {dt(item.dueDate)}
                  {overdue ? ' · Overdue' : ''}
                </span>
              }
            />
          )}

          <div>
            <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CircleDot className="h-3.5 w-3.5" />
              Status
            </dt>
            <dd className="mt-1">
              {onStatusChange ? (
                // Styled as the pill it replaces, so the control reads the
                // same whether or not this viewer may use it.
                <select
                  value={item.status}
                  onChange={(e) =>
                    void onStatusChange(e.target.value as ActionItemStatus)
                  }
                  className={`cursor-pointer appearance-none rounded-full px-3 py-1 text-xs font-medium ${ACTION_ITEM_STATUS_STYLES[item.status]}`}
                >
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {ACTION_ITEM_STATUS_LABELS[st]}
                    </option>
                  ))}
                </select>
              ) : (
                <span
                  className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${ACTION_ITEM_STATUS_STYLES[item.status]}`}
                >
                  {ACTION_ITEM_STATUS_LABELS[item.status]}
                </span>
              )}
            </dd>
          </div>

          <div>
            <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Flag className="h-3.5 w-3.5" />
              Priority
            </dt>
            <dd className="mt-1">
              {onEdit ? (
                <select
                  value={item.priority ?? 'medium'}
                  onChange={(e) => void save({ priority: e.target.value })}
                  className="w-full cursor-pointer rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary"
                >
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <option key={p} value={p}>
                      {ACTION_ITEM_PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-sm text-foreground">
                  {ACTION_ITEM_PRIORITY_LABELS[
                    (item.priority ?? 'medium') as 'low' | 'medium' | 'high'
                  ] ?? item.priority}
                </span>
              )}
            </dd>
          </div>
        </dl>

        {/* Who else is on this. The owner stays the one person answerable;
            a helper may move the status and record progress, nothing more. */}
        <div className="mt-6">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Assisting
          </p>

          {item.assistants && item.assistants.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {item.assistants.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-foreground"
                >
                  {a.user.name}
                  {onRemoveAssistant && (
                    <button
                      type="button"
                      onClick={() => void onRemoveAssistant(a.userId)}
                      aria-label={`Remove ${a.user.name}`}
                      className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Nobody else is helping with this yet.
            </p>
          )}

          {onAddAssistant &&
            (isAddingHelper ? (
              <div className="mt-3">
                <PersonPicker
                  value={null}
                  // The same people the item could be assigned to: help with
                  // work from a meeting comes from someone who was in it.
                  endpoint={`/api/v1/events/${item.minutes.event.id}/attendee-candidates`}
                  placeholder="Search the people invited to this meeting…"
                  allowUnassign={false}
                  excludeIds={[
                    ...(item.owner?.id ? [item.owner.id] : []),
                    ...(item.assistants ?? []).map((a) => a.userId),
                  ]}
                  onChange={async (person) => {
                    if (!person) return;
                    setEditError(null);
                    try {
                      await onAddAssistant(person);
                      setIsAddingHelper(false);
                    } catch (err) {
                      setEditError(
                        err instanceof Error
                          ? err.message
                          : 'Could not add that person.',
                      );
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setIsAddingHelper(false)}
                  className="mt-2 text-xs text-muted-foreground underline underline-offset-2"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingHelper(true)}
                className="mt-3 flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Ask someone to help
              </button>
            ))}
        </div>

        {onSaveProgress ? (
          <div className="mt-6 space-y-3 rounded-xl border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Work done
            </p>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What has been done so far…"
              className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary"
            />
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Link to the work (optional)"
              className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary"
            />
            {progressError && (
              <p className="text-xs text-destructive">{progressError}</p>
            )}
            <button
              type="button"
              disabled={isSavingProgress}
              onClick={async () => {
                setIsSavingProgress(true);
                setProgressError(null);
                try {
                  await onSaveProgress(notes, link);
                } catch (err) {
                  setProgressError(
                    err instanceof Error ? err.message : 'Could not save.',
                  );
                } finally {
                  setIsSavingProgress(false);
                }
              }}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {isSavingProgress ? 'Saving…' : 'Save progress'}
            </button>
          </div>
        ) : (
          (item.progressNotes || item.progressLink) && (
            <div className="mt-6 space-y-2 rounded-xl border border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Work done
              </p>
              {item.progressNotes && (
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {item.progressNotes}
                </p>
              )}
              {item.progressLink && (
                <a
                  href={item.progressLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm text-primary hover:underline"
                >
                  {item.progressLink}
                </a>
              )}
            </div>
          )
        )}

        <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <FileText className="h-3.5 w-3.5" /> Source event
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {item.minutes.event.title}
          </p>
          <Link
            href={`/administrative/events/${item.minutes.event.id}/minutes`}
            onClick={onClose}
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            View meeting minutes →
          </Link>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Raised {dt(item.createdAt)}
          {item.assignedBy?.name ? ` by ${item.assignedBy.name}` : ''} · Last
          changed {dt(item.updatedAt)}
        </p>
      </div>
    </Modal>
  );
}
