/**
 * jsdom has no IndexedDB, and the outbox is nothing without one.
 *
 * fake-indexeddb is a real implementation of the spec in memory, not a stub, so
 * these tests exercise the same transaction and key behaviour the browser
 * would rather than a mock that agrees with whatever the code does.
 */
import 'fake-indexeddb/auto';

import { beforeEach } from 'vitest';

beforeEach(() => {
  // Every test starts with an empty store and, importantly, an empty global —
  // the connectivity and outbox singletons hang off globalThis on purpose, so
  // leaving them in place would leak state between tests.
  indexedDB.deleteDatabase('govmeeting-offline');
  delete (globalThis as Record<string, unknown>).__govmeeting_connectivity__;
  delete (globalThis as Record<string, unknown>).__govmeeting_outbox__;
  document.cookie = 'uidHint=unittestnamespace; path=/';
});
