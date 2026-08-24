'use client';

import { useState } from 'react';
import {
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MapPin,
  ShieldAlert,
} from 'lucide-react';
import {
  CHECK_IN_METHOD_LABELS,
  type AttendanceRecord,
} from '@/lib/types/events';
import { Tooltip } from '@/components/ui/tooltip';

type SortKey = 'name' | 'time';

/**
 * A staff member is not asked for a title or organisation at check-in — their
 * account carries both, and the ministry stands in for the organisation. A
 * guest types their own. Somebody an organizer recorded at the desk has
 * neither, and an empty cell is the honest answer.
 */
function titleOf(c: AttendanceRecord): string | null {
  return c.guestTitle || c.user?.jobTitle || null;
}

function organisationOf(c: AttendanceRecord): string | null {
  return c.guestOrganisation || c.user?.ministry?.name || null;
}

function emailOf(c: AttendanceRecord): string | null {
  return c.user?.email ?? c.guestEmail ?? null;
}

function checkInTime(c: AttendanceRecord): string {
  return new Date(c.checkInAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function LocationCell({ record }: { record: AttendanceRecord }) {
  const { withinGeofence, gpsAccuracy, mockLocationFlag } = record;

  // Four states, and the difference between the middle two is the whole point:
  // a reading that arrived but was too vague to settle the question is not the
  // same as no check having taken place. What each verdict means is spelled out
  // under Help, in "What does the location column on the attendance list mean?".
  // The `hint` strings that used to sit here went with the tooltips below and
  // were never rendered again.
  const verdict =
    withinGeofence === true
      ? { label: 'Verified', className: 'bg-stat-green-bg text-success' }
      : withinGeofence === false
        ? {
            label: 'Outside area',
            className: 'bg-destructive/10 text-destructive',
          }
        : typeof gpsAccuracy === 'number'
          ? {
              label: 'Unconfirmed',
              className: 'bg-stat-gold-bg text-stat-gold-fg',
            }
          : {
              label: 'Not verified',
              className: 'bg-muted text-muted-foreground',
            };

  // No tooltips here any more. These four verdicts, the accuracy figure and the
  // mock-location flag are the evidence this product exists to produce, and all
  // of them sat on a bare <span> — unfocusable, so a keyboard or screen-reader
  // user could never reach the explanation, and on a phone reachable only by a
  // 500ms hold nothing advertises. The definitions live under Help now, where
  // they are reachable by everyone rather than by hover.
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${verdict.className}`}
      >
        <MapPin className="h-3 w-3" aria-hidden="true" />
        {verdict.label}
      </span>
      {typeof gpsAccuracy === 'number' && (
        <span className="text-[11px] text-muted-foreground">
          ±{gpsAccuracy}m
        </span>
      )}
      {mockLocationFlag && (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
          <ShieldAlert className="h-3 w-3" aria-hidden="true" />
          Mock GPS
        </span>
      )}
    </div>
  );
}

/**
 * The signature, fetched one at a time — the list endpoint reports only
 * whether one exists, because the images run to 200kB each.
 */
function SignatureCell({
  record,
  eventId,
  onOpen,
}: {
  record: AttendanceRecord;
  eventId: string;
  onOpen: (record: AttendanceRecord) => void;
}) {
  const [failed, setFailed] = useState(false);

  // A failed image is its own state. It used to fall in with "no signature",
  // so a dropped connection made the table assert that somebody who signed had
  // not — the one claim this register exists to be trusted about.
  if (failed) {
    return (
      <span className="rounded-full bg-alert-bg px-2 py-0.5 text-[11px] font-medium text-alert-fg">
        Signature didn&rsquo;t load
      </span>
    );
  }

  const state =
    record.signatureState ?? (record.hasSignature === false ? 'NONE' : 'SIGNED');

  if (state === 'ERASED') {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        Signature erased
      </span>
    );
  }

  if (state === 'NONE') {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        Signed in at the desk
      </span>
    );
  }

  return (
    <Tooltip content={`${record.signedName}'s signature. Open it to see it larger.`}>
    <button
      type="button"
      onClick={() => onOpen(record)}
      aria-label={`View ${record.signedName}'s signature`}
      className="rounded-md border border-border bg-white p-0.5 transition-colors hover:border-primary"
    >
      {/* Not next/image: this is a private API route behind the session
          cookie, not an optimizable static asset. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/v1/events/${eventId}/checkins/${record.id}/signature`}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-8 w-[88px] object-contain"
      />
    </button>
    </Tooltip>
  );
}

function SignaturePreview({
  record,
  eventId,
  onClose,
}: {
  record: AttendanceRecord;
  eventId: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Signature of ${record.signedName}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[1.5rem] border border-border bg-card p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">
              {record.signedName}
            </p>
            <p className="text-xs text-muted-foreground">
              Signed at {checkInTime(record)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/v1/events/${eventId}/checkins/${record.id}/signature`}
          alt={`Signature of ${record.signedName}`}
          className="mt-4 w-full rounded-lg border border-border bg-white object-contain p-3"
        />
      </div>
    </div>
  );
}

export function CheckedInTable({
  checkIns,
  eventId,
  canRemove,
  onRemove,
}: {
  checkIns: AttendanceRecord[];
  eventId: string;
  canRemove: boolean;
  onRemove: (attendanceId: string, name: string) => void;
}) {
  // Newest first out of the API, which is the order a desk wants during a
  // meeting; name order is for reading the register afterwards.
  const [sort, setSort] = useState<{ key: SortKey; ascending: boolean }>({
    key: 'time',
    ascending: false,
  });
  const [preview, setPreview] = useState<AttendanceRecord | null>(null);

  const rows = [...checkIns].sort((a, b) => {
    const direction = sort.ascending ? 1 : -1;
    if (sort.key === 'name') {
      return a.signedName.localeCompare(b.signedName) * direction;
    }
    return (
      (new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime()) *
      direction
    );
  });

  const toggleSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, ascending: !current.ascending }
        : { key, ascending: key === 'name' },
    );

  if (checkIns.length === 0) {
    return (
      <p className="rounded-[1.5rem] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nobody has checked in yet.
      </p>
    );
  }

  const sortButton = (key: SortKey, label: string) => {
    const active = sort.key === key;

    // A directional arrow rather than a change in opacity, and the state in the
    // accessible name rather than in a tooltip. The name used to say "Sort by
    // name" on the column the table was already sorted by — telling a screen
    // reader the opposite of what the screen showed — while the true state sat
    // in a hover nobody using a screen reader could trigger.
    const Icon = active ? (sort.ascending ? ArrowUp : ArrowDown) : ArrowUpDown;

    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground"
        aria-label={
          active
            ? `${label}, sorted ${sort.ascending ? 'A to Z' : 'Z to A'}. Activate to reverse.`
            : `Sort by ${label.toLowerCase()}`
        }
      >
        {label}
        <Icon
          aria-hidden="true"
          className={`h-3 w-3 ${active ? 'text-foreground' : 'opacity-40'}`}
        />
      </button>
    );
  };

  return (
    <>
      {/* The radius sits on the outer element and the scroller inside it: on
          one element the rounded corners clip the content as it scrolls. */}
      <div className="hidden overflow-hidden rounded-[1.5rem] border border-border bg-card sm:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr className="text-left text-xs font-semibold text-muted-foreground">
                <th className="px-4 py-3">{sortButton('name', 'Name')}</th>
                <th className="px-4 py-3 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 uppercase tracking-wide">Title</th>
                <th className="px-4 py-3 uppercase tracking-wide">
                  Organisation
                </th>
                <th className="px-4 py-3 uppercase tracking-wide">Phone</th>
                <th className="px-4 py-3 uppercase tracking-wide">Method</th>
                <th className="px-4 py-3">{sortButton('time', 'Checked in')}</th>
                <th className="px-4 py-3 uppercase tracking-wide">Location</th>
                <th className="px-4 py-3 uppercase tracking-wide">Signature</th>
                {canRemove && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => (
                <tr
                  key={c.id}
                  className={`border-b border-border ${i % 2 === 1 ? 'bg-muted/10' : ''}`}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">
                      {c.signedName}
                    </span>
                    {c.isWalkIn && (
                      <span className="ml-2 rounded-full bg-stat-gold-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stat-gold-fg">
                        Walk-in
                      </span>
                    )}
                    {!c.userId && (
                      <p className="text-xs text-muted-foreground">Guest</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {emailOf(c) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {titleOf(c) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {organisationOf(c) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.guestPhone ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {CHECK_IN_METHOD_LABELS[c.checkInMethod] ?? c.checkInMethod}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {checkInTime(c)}
                  </td>
                  <td className="px-4 py-3">
                    <LocationCell record={c} />
                  </td>
                  <td className="px-4 py-3">
                    <SignatureCell
                      record={c}
                      eventId={eventId}
                      onOpen={setPreview}
                    />
                  </td>
                  {canRemove && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onRemove(c.id, c.signedName || c.user?.name || "this attendee")}
                        aria-label={`Remove check-in for ${c.signedName}`}
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Same records as cards, because this page is read on a phone at the
          door as often as at a desk. */}
      <ul className="space-y-3 sm:hidden">
        {rows.map((c) => (
          <li
            key={c.id}
            className="rounded-[1.25rem] border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  {c.signedName}
                  {c.isWalkIn && (
                    <span className="rounded-full bg-stat-gold-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stat-gold-fg">
                      Walk-in
                    </span>
                  )}
                </p>
                {(titleOf(c) || organisationOf(c)) && (
                  <p className="truncate text-xs text-muted-foreground">
                    {[titleOf(c), organisationOf(c)].filter(Boolean).join(' · ')}
                  </p>
                )}
                {emailOf(c) && (
                  <p className="truncate text-xs text-muted-foreground">
                    {emailOf(c)}
                    {c.guestPhone ? ` · ${c.guestPhone}` : ''}
                  </p>
                )}
              </div>
              {canRemove && (
                <button
                  onClick={() => onRemove(c.id, c.signedName || c.user?.name || "this attendee")}
                  aria-label={`Remove check-in for ${c.signedName}`}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {CHECK_IN_METHOD_LABELS[c.checkInMethod] ?? c.checkInMethod} ·{' '}
                {checkInTime(c)}
              </span>
              <LocationCell record={c} />
            </div>

            <div className="mt-3">
              <SignatureCell record={c} eventId={eventId} onOpen={setPreview} />
            </div>
          </li>
        ))}
      </ul>

      {preview && (
        <SignaturePreview
          record={preview}
          eventId={eventId}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}
