import { CACHE_PREFIXES, PAGE_CACHE_PREFIX } from './config';
import { purgeOfflineQueries } from './queryPersist';

/**
 * Cache deletion, done from the page rather than by asking the worker.
 *
 * The page has the same access to Cache Storage that the worker does, so this
 * needs no postMessage round trip — and more to the point it still works when
 * there is no worker controlling the page, which is exactly the situation after
 * a teardown, and exactly when the caches most need to go.
 *
 * Every function here is safe to call when the API is missing or throws. Cache
 * Storage is unavailable in some private-browsing modes and can reject when a
 * profile's site data is locked down, and none of that should break signing out.
 */

async function deleteMatching(predicate: (name: string) => boolean): Promise<string[]> {
  if (typeof caches === 'undefined') return [];
  try {
    const names = await caches.keys();
    const doomed = names.filter(predicate);
    await Promise.all(doomed.map((n) => caches.delete(n)));
    return doomed;
  } catch {
    return [];
  }
}

/** Drops cached documents and RSC payloads, leaving build assets alone. */
export function purgePageCaches(): Promise<string[]> {
  return deleteMatching((n) => n.startsWith(PAGE_CACHE_PREFIX));
}

/**
 * Drops everything kept for reading offline: the stored pages and the data they
 * show. At sign-out, and at sign-in too — a session that merely expired never
 * reaches sign-out, and the next person to sign in must not inherit it.
 */
export async function purgeOfflineData(): Promise<void> {
  await Promise.all([purgePageCaches(), purgeOfflineQueries()]);
}

/** Drops everything this app has cached. Used by the teardown paths. */
export function purgeAllPwaCaches(): Promise<string[]> {
  return deleteMatching((n) => CACHE_PREFIXES.some((p) => n.startsWith(p)));
}
