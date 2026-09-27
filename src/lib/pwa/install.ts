/**
 * Everything about "can this be installed, and how".
 *
 * `beforeinstallprompt` fires once, early, and is gone if nothing was listening
 * — so capture has to start with the app, not when some component that wants to
 * draw a button happens to mount. ServiceWorkerManager is mounted in the root
 * layout and calls startCapturingInstallPrompt() for exactly that reason; the
 * hook then reads what was captured, whichever of the two happened first.
 */

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallState {
  /** A prompt is in hand and can be shown. */
  canInstall: boolean;
  /** Already running as an installed app, or installed during this session. */
  isInstalled: boolean;
  /** iPhone, iPad or iPod — including iPadOS, which claims to be a Mac. */
  isIos: boolean;
}

interface Store {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
  started: boolean;
  /** Bumped whenever anything above changes, so the snapshot can be cached. */
  version: number;
  cached: InstallState | null;
  cachedVersion: number;
  listeners: Set<() => void>;
}

/**
 * Hung off globalThis rather than kept in a module-level `let`.
 *
 * Module scope is not reliably a singleton under this bundler — the same module
 * can be evaluated more than once, and then the copy holding the captured event
 * is not the copy the hook is reading from, so the install button never
 * appears and nothing looks wrong anywhere.
 */
const KEY = '__govmeetingPwaInstall';

function store(): Store {
  const g = globalThis as typeof globalThis & { [KEY]?: Store };
  if (!g[KEY]) {
    g[KEY] = {
      deferred: null,
      installed: false,
      started: false,
      version: 0,
      cached: null,
      cachedVersion: -1,
      listeners: new Set(),
    };
  }
  return g[KEY];
}

function changed() {
  const s = store();
  s.version += 1;
  for (const listener of s.listeners) listener();
}

/** Idempotent: safe to call on every mount. */
export function startCapturingInstallPrompt(): void {
  const s = store();
  if (s.started || typeof window === 'undefined') return;
  s.started = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    // Without this Chrome shows its own mini-infobar, and the event cannot be
    // replayed later from our own UI.
    event.preventDefault();
    s.deferred = event as BeforeInstallPromptEvent;
    changed();
  });

  window.addEventListener('appinstalled', () => {
    s.installed = true;
    // Single-use: a consumed or stale prompt cannot be shown again.
    s.deferred = null;
    changed();
  });

  // Someone can open the installed copy while this tab is still on screen.
  const mq = window.matchMedia('(display-mode: standalone)');
  mq.addEventListener('change', changed);
}

export function subscribeToInstallState(listener: () => void): () => void {
  const s = store();
  s.listeners.add(listener);
  return () => s.listeners.delete(listener);
}

/**
 * Cached against a version counter, not recomputed per call.
 *
 * useSyncExternalStore compares snapshots by identity and re-renders forever if
 * a fresh object comes back every time it asks.
 */
export function getInstallState(): InstallState {
  const s = store();
  if (s.cachedVersion !== s.version || !s.cached) {
    s.cached = compute(s);
    s.cachedVersion = s.version;
  }
  return s.cached;
}

const SERVER_STATE: InstallState = Object.freeze({
  canInstall: false,
  isInstalled: false,
  isIos: false,
});

/** The server cannot know any of this, and it is prerendered. */
export function getServerInstallState(): InstallState {
  return SERVER_STATE;
}

function compute(s: Store): InstallState {
  const ua = navigator.userAgent;

  // iPadOS 13+ reports itself as a Mac; the touch points are what give it away.
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  return {
    canInstall: !!s.deferred,
    isInstalled: s.installed || isStandalone(),
    isIos,
  };
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // Non-standard and iOS-only, and the only signal iOS gives.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Shows the browser's install dialog. Resolves to whether it was accepted.
 *
 * The event is single-use however it ends, so it is discarded either way and
 * the affordance offering it disappears.
 */
export async function promptInstall(): Promise<boolean> {
  const s = store();
  const event = s.deferred;
  if (!event) return false;
  s.deferred = null;
  changed();
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome === 'accepted';
  } catch {
    return false;
  }
}
