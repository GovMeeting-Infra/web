import type { Query } from '@tanstack/react-query';
import type {
  PersistedClient,
  Persister,
} from '@tanstack/react-query-persist-client';

/**
 * Where the installed app keeps what it last read, for reading offline.
 *
 * The same rules as the stored pages in public/sw.js (CACHE_AUTHENTICATED_PAGES):
 * installed app only, seven days, one person at a time, gone on sign-in and
 * sign-out. The pages and this data are two halves of one thing — a stored page
 * with none of its data opens onto spinners.
 *
 * IndexedDB rather than localStorage: a meeting with its attendees and minutes
 * is easily past localStorage's 5 MB, and localStorage blocks the main thread
 * on every write.
 */

/** Mirrors PAGE_MAX_AGE_MS in public/sw.js. */
export const OFFLINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Bump when a kept query's shape changes incompatibly. Not the build id: that
 * would throw away everything saved at every deploy, and the data outlives the
 * build in a way the stored pages cannot.
 */
export const OFFLINE_BUSTER = 'v1';

/**
 * The only queries kept, by the first part of their key. An allowlist, so a new
 * screen is not kept until somebody decides it should be.
 *
 * Deliberately absent:
 * - notifications, notifications-unread*: read state would come back unread.
 * - dashboard-analytics and reports: figures read as current when they are not.
 * - search and the activity log: an audit trail read from a stale copy is not
 *   an audit trail.
 * - checkin-code: a five-minute token.
 * - co-organizer-candidates: a list of people, some since deactivated.
 */
const KEPT = new Set([
  'me',
  'my-preferences',
  'dashboard-live',
  'dashboard-upcoming',
  'dashboard-action-items',
  'calendar',
  'calendar-day',
  'events',
  'event',
  'minutes-list',
  'minutes',
  'minutes-can-edit',
  'actionItems',
  'action-items',
]);

/** Only answers: persisting an error would replay one that has likely passed. */
export function shouldKeepQuery(query: Query): boolean {
  return (
    query.state.status === 'success' &&
    typeof query.queryKey[0] === 'string' &&
    KEPT.has(query.queryKey[0])
  );
}

const DB = 'govmeeting-offline';
const STORE = 'kv';
const KEY = 'queries';

interface Saved {
  userId: string;
  client: PersistedClient;
}

/**
 * Every call treats storage as possibly absent — Safari private browsing and
 * managed devices refuse it — and never lets that break the page.
 */
function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    } finally {
      db.close();
    }
  });
}

/**
 * A persister bound to one user.
 *
 * What is saved records whose it is, and a restore for anyone else discards it
 * — on a shared device the previous person's meetings must not appear under
 * the next person's name, whether or not they signed out.
 *
 * Writes are throttled: the query cache changes on every fetch, and each save
 * serialises all of it.
 */
export function createOfflinePersister(userId: string): Persister {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: PersistedClient | null = null;
  const madeUnder = generation();

  return {
    persistClient(client) {
      pending = client;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        if (generation() !== madeUnder) return;
        const value: Saved = { userId, client: pending! };
        void run('readwrite', (s) => s.put(value, KEY));
      }, 1000);
    },
    async restoreClient() {
      const saved = await run<Saved | undefined>('readonly', (s) => s.get(KEY));
      if (!saved) return undefined;
      if (saved.userId !== userId) {
        await purgeOfflineQueries();
        return undefined;
      }
      return saved.client;
    },
    async removeClient() {
      await run('readwrite', (s) => s.delete(KEY));
    },
  };
}

/**
 * Bumped by every purge. A persister remembers the value it was made under and
 * stops writing once it moves on, so a throttled save still pending from before
 * a sign-out or sign-in cannot write the previous person's data back. A counter
 * rather than a flag because sign-in continues in the same document: the
 * persister made for the new session must still be able to write.
 * On globalThis because module scope is not reliably one copy in this bundler.
 */
const GENERATION = '__govmeetingOfflineGeneration';
function generation(): number {
  return ((globalThis as Record<string, unknown>)[GENERATION] as number) ?? 0;
}

/** Deletes everything kept. Safe to call when nothing was. */
export async function purgeOfflineQueries(): Promise<void> {
  (globalThis as Record<string, unknown>)[GENERATION] = generation() + 1;
  await run('readwrite', (s) => s.delete(KEY));
}
