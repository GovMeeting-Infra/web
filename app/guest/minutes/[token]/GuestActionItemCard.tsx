'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GuestActionItem } from '@/lib/guest-minutes';
import { ACTION_ITEM_STATUS_LABELS } from '@/lib/types/events';

const STATUS_PILL: Record<string, string> = {
  TODO: 'bg-stat-blue-bg text-primary',
  IN_PROGRESS: 'bg-stat-gold-bg text-stat-gold-fg',
  BLOCKED: 'bg-red-50 text-red-700',
  COMPLETED: 'bg-stat-green-bg text-success',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

/**
 * One action item on the guest page.
 *
 * A client component only because the viewer's own items are editable here —
 * everything else on the page stays server-rendered. Items belonging to someone
 * else render read-only, and the server refuses a write to them regardless, so
 * the flag is a convenience rather than the control.
 */
export function GuestActionItemCard({
  item,
  token,
}: {
  item: GuestActionItem;
  token: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(item.status);
  const [notes, setNotes] = useState(item.progressNotes ?? '');
  const [link, setLink] = useState(item.progressLink ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch(
        `/api/v1/guest/minutes/${encodeURIComponent(token)}/action-items/${item.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status,
            progressNotes: notes,
            progressLink: link,
          }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? 'Could not save your update.');
      }

      setSaved(true);
      // Pull the record again so the summary line and any other view of this
      // item reflect the new status.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{item.title}</p>
          {item.description && (
            <p className="mt-1 text-sm text-slate-600">{item.description}</p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            {item.ownerName ?? 'Unassigned'} &middot; due{' '}
            {new Date(item.dueDate).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
            STATUS_PILL[status] ?? STATUS_PILL.TODO
          }`}
        >
          {ACTION_ITEM_STATUS_LABELS[status] ?? status}
        </span>
      </div>

      {item.isMine ? (
        <div className="mt-4 space-y-3 border-t border-[#eef3fa] pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium text-slate-600">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="ml-2 rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-slate-900"
              >
                {Object.entries(ACTION_ITEM_STATUS_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Real labels, not placeholders. A placeholder is not a label — it
              is announced inconsistently, and it disappears the moment someone
              starts typing, so a guest who pauses loses the only clue about
              what the box is for. This surface is reached by external
              attendees on unknown devices, who can least work around it. */}
          <div>
            <label
              htmlFor={`notes-${item.id}`}
              className="block text-xs font-medium text-slate-600"
            >
              Progress so far
            </label>
            <textarea
              id={`notes-${item.id}`}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label
              htmlFor={`link-${item.id}`}
              className="block text-xs font-medium text-slate-600"
            >
              Link to the work (optional)
            </label>
            <input
              id={`link-${item.id}`}
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>

          {/* Announced. Saving produced a visual confirmation only, so a screen
              reader user had no way to know whether their update took. */}
          <div role="status" aria-live="polite">
            {error && <p className="text-xs text-red-700">{error}</p>}
            {saved && !error && (
              <p className="text-xs text-success">Update saved.</p>
            )}
          </div>

          <button
            type="button"
            onClick={save}
            disabled={isSaving}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save update'}
          </button>
        </div>
      ) : (
        (item.progressNotes || item.progressLink) && (
          <div className="mt-4 space-y-2 border-t border-[#eef3fa] pt-4">
            {item.progressNotes && (
              <p className="whitespace-pre-wrap text-sm text-slate-600">
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
    </div>
  );
}
