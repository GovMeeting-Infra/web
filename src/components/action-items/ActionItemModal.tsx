'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, CalendarDays, User, UserCheck, CircleDot, FileText } from 'lucide-react';
import {
  PersonPicker,
  type DirectoryPerson,
} from '@/components/ui/person-picker';
import {
  ACTION_ITEM_STATUS_LABELS,
  POINT_LABELS,
  POINT_STYLES,
  isActionItemOverdue,
  type BoardActionItem,
} from '@/lib/types/events';

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
 * Detail view. Closes on X, Escape or backdrop click.
 *
 * The assignee is editable when `onReassign` is supplied; the caller decides
 * whether this user may reassign, since the server is the real authority.
 */
export function ActionItemModal({
  item,
  onClose,
  onReassign,
  onSaveProgress,
}: {
  item: BoardActionItem;
  onClose: () => void;
  onReassign?: (ownerId: string | null) => Promise<void>;
  /** Omitted when the viewer may not record progress — the block turns read-only. */
  onSaveProgress?: (notes: string, link: string) => Promise<void>;
}) {
  const [isReassigning, setIsReassigning] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [notes, setNotes] = useState(item.progressNotes ?? '');
  const [link, setLink] = useState(item.progressLink ?? '');
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);

  const handleReassign = async (person: DirectoryPerson | null) => {
    if (!onReassign) return;
    setIsReassigning(true);
    setReassignError(null);
    try {
      await onReassign(person?.id ?? null);
    } catch (err) {
      setReassignError(
        err instanceof Error ? err.message : 'Could not change the assignee.',
      );
    } finally {
      setIsReassigning(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const overdue = isActionItemOverdue(item);
  const dt = (v: string) =>
    new Date(v).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-primary">{item.title}</h2>
            <span
              className={`mt-2 inline-block rounded border px-2 py-0.5 text-xs font-medium ${POINT_STYLES[item.point]}`}
            >
              {POINT_LABELS[item.point]}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {item.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
            {item.description}
          </p>
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
                  placeholder="Search for a colleague to assign…"
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
          <Field
            icon={<CalendarDays className="h-3.5 w-3.5" />}
            label="Timeline"
            value={
              <span className={overdue ? 'font-semibold text-destructive' : ''}>
                {dt(item.dueDate)}
                {overdue ? ' · Overdue' : ''}
              </span>
            }
          />
          <Field
            icon={<CircleDot className="h-3.5 w-3.5" />}
            label="Status"
            value={ACTION_ITEM_STATUS_LABELS[item.status] ?? item.status}
          />
        </dl>

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
              className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Link to the work (optional)"
              className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
          Created {dt(item.createdAt)} · Updated {dt(item.updatedAt)}
        </p>
      </div>
    </div>
  );
}
