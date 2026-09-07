'use client';

import type {
  PersistedClient,
  Persister,
} from '@tanstack/react-query-persist-client';
import type { Query } from '@tanstack/react-query';
import { idbGet, idbSet, idbDelete } from './db';
import { cacheNamespace } from './uid';

/**
 * Keeps the query cache on disk so a meeting still reads offline.
 *
 * IndexedDB rather than the bundled localStorage persister, for the same two
 * reasons the store itself uses it: an attendee list with signatures goes past
 * localStorage's 5 MB ceiling, and localStorage is synchronous, so writing the
 * whole cache would block the main thread on every change.
 *
 * The key carries the namespace, so on a shared device one person's cached
 * meetings cannot be restored into another person's session.
 */
const key = () => `${cacheNamespace()}:react-query`;

export const indexedDbPersister: Persister = {
  async persistClient(client: PersistedClient) {
    await idbSet('reads', key(), client);
  },
  async restoreClient() {
    return (await idbGet<PersistedClient>('reads', key())) ?? undefined;
  },
  async removeClient() {
    await idbDelete('reads', key());
  },
};

/**
 * Which queries are worth keeping, and which would be actively harmful.
 *
 * An allowlist rather than a denylist. A new endpoint should have to be thought
 * about before its responses start living on someone's device — the default has
 * to be "not stored", because the cost of wrongly persisting something is a
 * stale answer presented as fact, or personal data left on a shared tablet.
 */
const PERSISTED_KEYS = [
  'events',
  'event',
  'minutes',
  'minutes-can-edit',
  'actionItems',
  'action-items',
  'attendees-confirmed',
  'attendees-declined',
  'checkins',
];

/**
 * Deliberately excluded, with reasons, because each looks harmless:
 *
 *  checkin-code  A check-in token is valid for five minutes. Restoring one a
 *                day later would show a QR code that cannot work, which is
 *                worse than showing none.
 *  notifications Restoring these makes read items unread and resurrects
 *                dismissed ones.
 *  activity-log  An audit trail read from a stale copy is not an audit trail.
 *  reports       Aggregates presented as current while being days old.
 *  search        Results for a query nobody has just typed.
 *  users         A directory including people since deactivated.
 */
export function shouldPersistQuery(query: Query): boolean {
  const head = query.queryKey?.[0];
  if (typeof head !== 'string') return false;
  // Only successful data. Persisting an error would replay a failure that has
  // very likely resolved by the time anyone sees it.
  if (query.state.status !== 'success') return false;
  return PERSISTED_KEYS.includes(head);
}

/**
 * A week. Long enough to cover the kind of outage this is for — the stated
 * worst case is unpredictable, and rosters are prefetched days ahead — and
 * short enough that nothing is served from a copy old enough to mislead.
 */
export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
