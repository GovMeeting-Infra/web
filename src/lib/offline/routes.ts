'use client';

import type { EntityType, OpKind } from './types';

/**
 * Which writes may be deferred, and — more importantly — which may not.
 *
 * An allowlist. Anything not named here keeps today's behaviour exactly: the
 * request fails, the page shows its own message, nothing is queued. That is the
 * safe default, because deferring a write changes what it means. A request that
 * emails somebody, or whose meaning depends on the moment it runs, cannot be
 * honestly replayed an hour later.
 *
 * Phase one of the queue carries minutes alone. They are the highest-value
 * thing typed in a room with no signal, and the only flow with an existing
 * safety net — useDraftBackup — if any of this misbehaves.
 */

export interface OfflineRoute {
  kind: OpKind;
  method: 'POST' | 'PATCH';
  match: RegExp;
  /** Identifies the record, so repeated saves collapse onto one another. */
  entityType: EntityType;
  entityId: (match: RegExpMatchArray) => string;
  collapseByEntity: boolean;
  /**
   * Where the record's id lives when the path does not carry one — a create,
   * which is named by its body rather than its address.
   */
  entityIdFromBody?: (body: unknown) => string;
  label: (match: RegExpMatchArray, body: unknown) => string;
  /**
   * What the caller gets back so its success path can run unchanged.
   *
   * Shaped like the real response, because the page reads it: the minutes
   * editor clears its draft backup and shows a saved-at time off the back of
   * this returning rather than throwing.
   */
  synthesize: (match: RegExpMatchArray, body: unknown) => unknown;
}

const MINUTES = /^\/api\/v1\/events\/([^/?]+)\/minutes(?:\?.*)?$/;
const OFFLINE_REGISTER =
  /^\/api\/v1\/checkin\/([^/?]+)\/offline-register(?:\?.*)?$/;
const EVENT_CREATE = /^\/api\/v1\/events(?:\?.*)?$/;
const EVENT_UPDATE = /^\/api\/v1\/events\/([^/?]+)(?:\?.*)?$/;
const EVENT_SERIES = /^\/api\/v1\/events\/([^/?]+)\/series(?:\?.*)?$/;
const ACTION_ITEM_CREATE =
  /^\/api\/v1\/events\/([^/?]+)\/minutes\/action-items(?:\?.*)?$/;
const ACTION_ITEM_UPDATE =
  /^\/api\/v1\/events\/[^/?]+\/action-items\/([^/?]+)(?:\?.*)?$/;

export const OFFLINE_ROUTES: OfflineRoute[] = [
  {
    kind: 'minutes.upsert',
    entityType: 'minutes',
    /*
     * Always POST on the way out, whichever verb the page used.
     *
     * Offline the client cannot know whether a record exists — the read it
     * would need is the thing that is failing — and PATCH answers 404 when it
     * does not. POST handles both: draftMinutes is upsert-shaped and the
     * eventId is unique, so a replay cannot duplicate, and the server applies
     * the same edit-window and archive rules to it either way.
     */
    method: 'POST',
    match: MINUTES,
    entityId: (m) => m[1],
    collapseByEntity: true,
    label: () => 'Meeting minutes',
    synthesize: (_m, body) => ({ ...(body as object), __pending: true }),
  },
  {
    kind: 'attendance.register',
    method: 'POST',
    match: OFFLINE_REGISTER,
    entityType: 'attendance',
    entityId: (m) => m[1],
    /*
     * Never collapsed, unlike minutes.
     *
     * Each send carries the people recorded since the last one, so replacing a
     * pending batch with a newer one would drop everybody in the older one. The
     * register is append-only in a way a minutes list is not: an earlier save
     * has names a later one does not.
     */
    collapseByEntity: false,
    label: () => 'Attendance register',
    synthesize: (_m, body) => {
      const records = (body as { records?: unknown[] })?.records ?? [];
      // Shaped like the real response so the register screen can mark each
      // person as recorded without a special offline branch.
      return {
        syncedAt: null,
        __pending: true,
        results: records.map((_r, index) => ({
          index,
          id: null,
          status: 'RECORDED' as const,
        })),
      };
    },
  },
  {
    kind: 'event.create',
    method: 'POST',
    match: EVENT_CREATE,
    entityType: 'event',
    /*
     * The id comes from the body, not the path — there is no path yet.
     *
     * The page mints it before sending, online as well as off, so the address
     * it navigates to is the record's real one either way. That is what makes a
     * meeting created during an outage keep its link rather than move when it
     * syncs.
     */
    entityId: () => '',
    entityIdFromBody: (body) => (body as { id?: string })?.id ?? '',
    collapseByEntity: false,
    label: (_m, body) =>
      `Meeting: ${(body as { title?: string })?.title ?? 'untitled'}`,
    synthesize: (_m, body) => ({ ...(body as object), __pending: true }),
  },
  {
    kind: 'event.series',
    method: 'POST',
    match: EVENT_SERIES,
    entityType: 'event',
    entityId: (m) => m[1],
    collapseByEntity: false,
    label: () => 'Repeat dates',
    synthesize: () => ({ __pending: true, occurrences: [] }),
  },
  {
    kind: 'actionItem.create',
    method: 'POST',
    match: ACTION_ITEM_CREATE,
    entityType: 'actionItem',
    entityId: () => '',
    entityIdFromBody: (body) => (body as { id?: string })?.id ?? '',
    collapseByEntity: false,
    label: (_m, body) =>
      `Action item: ${(body as { title?: string })?.title ?? 'untitled'}`,
    synthesize: (_m, body) => ({
      ...(body as object),
      status: 'TODO',
      __pending: true,
    }),
  },
  {
    kind: 'actionItem.update',
    method: 'PATCH',
    match: ACTION_ITEM_UPDATE,
    entityType: 'actionItem',
    entityId: (m) => m[1],
    /*
     * Collapsed, like minutes: dragging a card across a board produces a run of
     * updates to the same item, and only the last one describes where it ended
     * up.
     */
    collapseByEntity: true,
    label: () => 'Action item change',
    synthesize: (_m, body) => ({ ...(body as object), __pending: true }),
  },
  {
    kind: 'event.update',
    /*
     * Ordering is not what keeps this from swallowing /events/:id/minutes —
     * the segment pattern is [^/?]+, which stops at a slash, so these do not
     * overlap. Worth stating, because the obvious reading is that a rule this
     * broad must depend on coming last, and a later edit made on that
     * assumption would be building on something untrue.
     */
    method: 'PATCH',
    match: EVENT_UPDATE,
    entityType: 'event',
    entityId: (m) => m[1],
    collapseByEntity: true,
    label: () => 'Meeting details',
    synthesize: (_m, body) => ({ ...(body as object), __pending: true }),
  },
];

export function matchOfflineRoute(
  path: string,
  method: string,
): { route: OfflineRoute; match: RegExpMatchArray } | null {
  const verb = method.toUpperCase();
  // Only these two are ever deferred. A DELETE that is queued and replayed
  // after someone has recreated the thing deletes the new one.
  if (verb !== 'POST' && verb !== 'PATCH') return null;

  for (const route of OFFLINE_ROUTES) {
    const match = path.match(route.match);
    if (match) return { route, match };
  }
  return null;
}

/**
 * Not queued, and each for its own reason. Written down because every one of
 * them looks queueable at a glance:
 *
 *  minutes/publish   Emails external recipients and mints guest access tokens.
 *                    Queuing it makes "published" a lie for the length of an
 *                    outage, to people who were told the record was final.
 *  events/:id/publish, cancel, DELETE
 *                    Each announces something. A cancellation that arrives
 *                    after the meeting has been sat through is worse than one
 *                    that failed loudly at the time.
 *  checkin-code      The token lives five minutes. A queued request to mint one
 *                    is meaningless by the time it is sent.
 *  attendee invite/remove
 *                    Sends email.
 *  uploads           A multi-megabyte blob and a signature that expires.
 *  auth, admin       Nothing about a session or a permission should be applied
 *                    from a snapshot of an hour ago.
 */
export const DELIBERATELY_NOT_QUEUED = Object.freeze([
  '/api/v1/events/:id/minutes/publish',
  '/api/v1/events/:id/publish',
  '/api/v1/events/:id/cancel',
  '/api/v1/checkin-code/:id',
  '/api/v1/uploads/signature',
  '/api/v1/auth/*',
  '/api/v1/admin/*',
]);
