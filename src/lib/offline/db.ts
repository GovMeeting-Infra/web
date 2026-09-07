'use client';

import { openDB, type IDBPDatabase } from 'idb';

/**
 * The browser-side store everything offline is kept in.
 *
 * IndexedDB rather than localStorage, because of what has to fit: a roster with
 * signatures runs to megabytes, well past the 5 MB localStorage ceiling, and
 * localStorage is synchronous — writing a meeting's worth of attendance to it
 * would block the main thread mid-check-in.
 *
 * `idb` rather than the raw API: three object stores do not need a query
 * engine, but the event-based API is easy to get subtly wrong, and this is the
 * code that decides whether a room's worth of minutes survives.
 */

const DB_NAME = 'govmeeting-offline';

/**
 * Bump when the stores change shape. The upgrade below is written to be
 * re-runnable from any earlier version rather than as a chain of migrations —
 * cached reads can always be thrown away and refetched, so there is nothing
 * here worth migrating carefully. That stops being true when the outbox
 * arrives, and this comment should be revisited then.
 */
const DB_VERSION = 1;

export const STORE = {
  /** Mirror of the React Query cache, so lists render before any network call. */
  reads: 'reads',
  /** Who the shell should render as when the API cannot be asked. */
  session: 'session',
  /** Small bookkeeping values: namespace in use, last sync, storage decisions. */
  meta: 'meta',
} as const;

let handle: Promise<IDBPDatabase> | null = null;

/**
 * Opens the database once per tab.
 *
 * Rejects rather than throwing synchronously so every caller can treat storage
 * as something that might simply not be there — Safari private browsing,
 * a locked-down managed device, or a user who has blocked site data. None of
 * those may break the app; they only cost it its memory.
 */
export function offlineDb(): Promise<IDBPDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }

  if (!handle) {
    handle = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const name of Object.values(STORE)) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
      },
      blocking() {
        // Another tab is upgrading. Close so it can, rather than deadlocking
        // both; the next call reopens.
        void handle?.then((db) => db.close());
        handle = null;
      },
    }).catch((error) => {
      // Do not cache the rejection: a transient failure would otherwise make
      // storage permanently unavailable for the life of the tab.
      handle = null;
      throw error;
    });
  }

  return handle;
}

/** Read a value, treating any storage failure as a miss. */
export async function idbGet<T>(
  store: keyof typeof STORE,
  key: string,
): Promise<T | null> {
  try {
    const db = await offlineDb();
    return ((await db.get(STORE[store], key)) as T | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Write a value. Returns false when storage refused, so callers can react. */
export async function idbSet(
  store: keyof typeof STORE,
  key: string,
  value: unknown,
): Promise<boolean> {
  try {
    const db = await offlineDb();
    await db.put(STORE[store], value, key);
    return true;
  } catch {
    return false;
  }
}

export async function idbDelete(
  store: keyof typeof STORE,
  key: string,
): Promise<void> {
  try {
    const db = await offlineDb();
    await db.delete(STORE[store], key);
  } catch {
    // Nothing to remove, or nowhere to remove it from.
  }
}

/**
 * Drop everything belonging to one namespace.
 *
 * Called on sign-out. Keys are prefixed with the namespace precisely so this
 * can be a prefix sweep rather than a full wipe — a shared tablet may have
 * another signed-in tab, and one person leaving must not clear the other's
 * cache out from under them.
 */
export async function idbPurgeNamespace(namespace: string): Promise<void> {
  const prefix = `${namespace}:`;
  try {
    const db = await offlineDb();
    await Promise.all(
      Object.values(STORE).map(async (name) => {
        const keys = (await db.getAllKeys(name)) as IDBValidKey[];
        await Promise.all(
          keys
            .filter((k) => typeof k === 'string' && k.startsWith(prefix))
            .map((k) => db.delete(name, k)),
        );
      }),
    );
  } catch {
    // Storage unavailable; there is nothing cached to leak.
  }
}

/**
 * Ask the browser not to evict this origin's storage under pressure.
 *
 * Without it, IndexedDB is "best effort": the browser is free to clear it when
 * the device runs low, which for us would mean a queued check-in disappearing
 * between the meeting and the connection coming back. Granted silently on an
 * installed PWA, prompted or refused elsewhere — either way it is one call and
 * asking costs nothing.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export interface StorageUsage {
  usedBytes: number;
  quotaBytes: number;
  /** 0–1, or null when the browser will not say. */
  ratio: number | null;
}

export async function storageUsage(): Promise<StorageUsage | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return {
      usedBytes: usage,
      quotaBytes: quota,
      ratio: quota > 0 ? usage / quota : null,
    };
  } catch {
    return null;
  }
}
