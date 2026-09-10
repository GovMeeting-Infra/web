import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  reportReachable,
  reportUnreachable,
  currentConnectivity,
} from './connectivity';

/**
 * Whether the app believes it can reach the API.
 *
 * This is the thing that decides whether a person is told their work is safe,
 * so its failures are the expensive kind — and it has had two, both of which
 * these lock down.
 */

interface TestStore {
  state: 'online' | 'offline';
  hasEvidence: boolean;
  listeners: Set<() => void>;
}

/** The store, as any copy of the module would find it. */
function store(): TestStore {
  return (globalThis as Record<string, unknown>)
    .__govmeeting_connectivity__ as TestStore;
}

/** Subscribe the way useSyncExternalStore does, to observe notifications. */
function watch(): { calls: number } {
  const seen = { calls: 0 };
  // Touch the store so it exists, then add a listener to it directly.
  reportReachable();
  store().listeners.add(() => {
    seen.calls += 1;
  });
  return seen;
}

describe('connectivity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starts optimistic, so no banner flashes on every page load', () => {
    reportReachable();
    expect(store().state).toBe('online');
  });

  it('treats a failed request as offline', () => {
    reportUnreachable();
    expect(store().state).toBe('offline');
  });

  it('notifies when the verdict changes even though the state field does not', () => {
    /*
     * The bug this exists for.
     *
     * The verdict depends on two fields — the state, and whether any evidence
     * has arrived — and the notifier once compared only the state. A first
     * successful request flips `hasEvidence` while leaving state on its initial
     * 'online', so the answer went from offline to online and nobody was told.
     * The banner kept its very first snapshot and announced that the device was
     * offline for as long as the page stayed open, with every request
     * succeeding behind it.
     */
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    // Nothing has happened yet, so the browser's claim is all there is.
    reportUnreachable();
    store().hasEvidence = false;
    store().state = 'online';

    const seen = { calls: 0 };
    store().listeners.add(() => {
      seen.calls += 1;
    });

    reportReachable();

    expect(seen.calls).toBe(1);
    expect(store().hasEvidence).toBe(true);
  });

  it('says nothing when the verdict is unchanged', () => {
    // A run of successful requests must not re-render the whole shell each time.
    reportReachable();
    const seen = watch();
    reportReachable();
    reportReachable();
    expect(seen.calls).toBe(0);
  });

  it('lets a successful request outrank navigator.onLine', () => {
    /*
     * The browser answers "is an interface up", which is not the question. The
     * two disagree more often than they should — a captive portal, a machine
     * woken from sleep — and a device whose saves are landing must not be told
     * they cannot be sent.
     */
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    reportReachable();
    expect(currentConnectivity()).toBe('online');
  });

  it('believes the browser until something has actually been tried', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    // No request has settled, so there is nothing better to go on.
    expect(currentConnectivity()).toBe('offline');
  });

  it('keeps its state where a second copy of the module would find it', () => {
    /*
     * The other bug. State lived in module scope, and a bundler is free to
     * place a module in more than one chunk — it did, so the shell's banner and
     * the page inside it held separate states and contradicted each other on
     * the same screen. Nothing looked wrong, because `let state` simply does
     * not mean one state.
     *
     * Asserting on the location rather than the value: it is the well-known key
     * that makes every copy agree, so that is the thing worth pinning.
     */
    reportUnreachable();
    expect(
      (globalThis as Record<string, unknown>).__govmeeting_connectivity__,
    ).toBeDefined();
    expect(store().state).toBe('offline');
  });
});
