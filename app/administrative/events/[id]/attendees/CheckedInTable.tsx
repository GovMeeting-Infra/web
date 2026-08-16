'use client';

import { useState } from 'react';
import { X, ArrowUpDown, MapPin, ShieldAlert } from 'lucide-react';
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
  // same as no check having taken place. That distinction used to live only in
  // a comment here; the hints below say it to the reader instead.
  const verdict =
    withinGeofence === true
      ? {
          label: 'Verified',
          className: 'bg-stat-green-bg text-success',
          hint: 'Their phone placed them inside the check-in area the organiser set.',
        }
      : withinGeofence === false
        ? {
            label: 'Outside area',
            className: 'bg-destructive/10 text-destructive',
            hint: 'Their phone placed them outside the check-in area, even allowing for its margin of error.',
          }
        : typeof gpsAccuracy === 'number'
          ? {
              label: 'Unconfirmed',
              className: 'bg-stat-gold-bg text-stat-gold-fg',
              hint: 'A location arrived but was too vague to prove they were inside the area. They may well have been — indoors, a phone often cannot do better.',
            }
          : {
              label: 'Not verified',
              className: 'bg-muted text-muted-foreground',
              hint: 'No location was checked. Either no check-in area was set for this meeting, or an organiser recorded them at the desk.',
            };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Tooltip content={verdict.hint}>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${verdict.className}`}
        >
          <MapPin className="h-3 w-3" />
          {verdict.label}
        </span>
      </Tooltip>
      {typeof gpsAccuracy === 'number' && (
        <Tooltip
          content={`Their phone reported being accurate to about ${gpsAccuracy} metres. The smaller the number, the more certain the position.`}
        >
          <span className="text-[11px] text-muted-foreground">
            ±{gpsAccuracy}m
          </span>
        </Tooltip>
      )}
      {mockLocationFlag && (
        <Tooltip content="The phone reported a position no real one can produce, which is the usual signature of a location-spoofing app. Recorded rather than refused — it is a hint, not proof.">
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
            <ShieldAlert className="h-3 w-3" />
            Mock GPS
          </span>
        </Tooltip>
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

  if (record.hasSignature === false || failed) {
    return (
      <Tooltip content="Recorded by an organiser at the desk, so there was nobody to sign. People who scan the code sign for themselves.">
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          No signature
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={`The signature ${record.signedName} drew when they checked in. Click to see it larger.`}>
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
    // The current direction is conveyed only by icon opacity, which tells you
    // which column is sorted but never which way.
    const hint = active
      ? `Sorted by ${label.toLowerCase()}, ${
          sort.ascending ? 'A to Z' : 'Z to A'
        }. Click to reverse it.`
      : `Sort by ${label.toLowerCase()}`;

    return (
      <Tooltip content={hint}>
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className="inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground"
          aria-label={`Sort by ${label.toLowerCase()}`}
        >
          {label}
          <ArrowUpDown
            className={`h-3 w-3 ${active ? 'text-foreground' : 'opacity-40'}`}
          />
        </button>
      </Tooltip>
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
