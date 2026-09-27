/**
 * Whether the API can be reached, as best the page can tell.
 *
 * navigator.onLine is read in one direction only: false is proof, true is
 * nothing — a phone on a captive portal or a dead uplink reports true all day.
 * The real signal is apiFetch: a request that throws, or a 5xx with no JSON
 * body, never reached the API. That second case is the one easy to get wrong:
 * with the web server up and the API down, the Next rewrite answers a plain
 * 500 and fetch *succeeds*. Any JSON answer, even a 403, travelled the whole
 * way and means reachable.
 *
 * On globalThis because module scope is not reliably one copy in this bundler,
 * and a second copy would mean the banner never hears what apiFetch reports.
 */

export type Connectivity = 'online' | 'offline';

interface Store {
  state: Connectivity;
  started: boolean;
  listeners: Set<() => void>;
}

const KEY = '__govmeetingConnectivity';

function store(): Store {
  const g = globalThis as typeof globalThis & { [KEY]?: Store };
  if (!g[KEY]) g[KEY] = { state: 'online', started: false, listeners: new Set() };
  return g[KEY];
}

function set(state: Connectivity) {
  const s = store();
  if (s.state === state) return;
  s.state = state;
  for (const listener of s.listeners) listener();
}

function start() {
  const s = store();
  if (s.started || typeof window === 'undefined') return;
  s.started = true;
  if (navigator.onLine === false) s.state = 'offline';
  window.addEventListener('offline', () => set('offline'));
  // Optimistic: React Query refetches on reconnect, and if those requests fail
  // apiFetch reports offline again straight away.
  window.addEventListener('online', () => set('online'));
}

export function reportUnreachable(): void {
  start();
  set('offline');
}

export function reportReachable(): void {
  start();
  set('online');
}

export function subscribeToConnectivity(listener: () => void): () => void {
  start();
  const s = store();
  s.listeners.add(listener);
  return () => s.listeners.delete(listener);
}

export function getConnectivity(): Connectivity {
  start();
  return store().state;
}

/** Always online on the server, so the first render never shows the banner. */
export function getServerConnectivity(): Connectivity {
  return 'online';
}
