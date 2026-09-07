'use client';

import type { OpKind } from './types';

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
  entityId: (match: RegExpMatchArray) => string;
  collapseByEntity: boolean;
  label: (match: RegExpMatchArray) => string;
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

export const OFFLINE_ROUTES: OfflineRoute[] = [
  {
    kind: 'minutes.upsert',
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
