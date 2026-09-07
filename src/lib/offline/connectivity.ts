'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the app can currently reach the API.
 *
 * `navigator.onLine` is not that question. It answers "is there a network
 * interface up", which on the connections this app is used over is routinely
 * true while nothing reaches the server: a router that is powered but has lost
 * its uplink, a captive portal, a mobile connection showing bars and passing no
 * packets. Trusting it in the positive would leave the app cheerfully claiming
 * to be online through an entire outage.
 *
 * So it is used in one direction only. `onLine === false` is taken as proof of
 * offline, because the browser does not invent a missing interface. `true` is
 * taken as nothing at all, and the actual verdict comes from whether requests
 * are succeeding — which the API client reports here.
 */

export type Connectivity = 'online' | 'offline';

/**
 * Starts optimistic. The alternative is showing an offline banner to everyone
 * for the first few hundred milliseconds of every page load, which trains
 * people to ignore it.
 */
let state: Connectivity = 'online';
const listeners = new Set<() => void>();

function set(next: Connectivity): void {
  if (state === next) return;
  state = next;
  listeners.forEach((notify) => notify());
}

/**
 * A request just came back from the server, so the connection is real.
 *
 * Called on every success, including error responses: a 403 travelled the whole
 * way there and back, which is exactly the proof wanted here.
 */
export function reportReachable(): void {
  set('online');
}

/**
 * A request failed in a way that means it never arrived — a dropped connection
 * or our own timeout, not an answer we disliked.
 */
export function reportUnreachable(): void {
  set('offline');
}

/** True when the browser is certain there is no network at all. */
function browserSaysOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);

  const goOffline = () => set('offline');
  // Only a hint that it is worth trying again — the next request decides.
  const goOnline = () => set('online');

  window.addEventListener('offline', goOffline);
  window.addEventListener('online', goOnline);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener('offline', goOffline);
    window.removeEventListener('online', goOnline);
  };
}

function snapshot(): Connectivity {
  return browserSaysOffline() ? 'offline' : state;
}

/**
 * Server snapshot is always 'online' so the markup rendered on the instance
 * matches the client's first paint. An offline banner cannot be server-rendered
 * anyway — the instance has a connection by definition.
 */
const serverSnapshot = (): Connectivity => 'online';

export function useConnectivity(): Connectivity {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export function useIsOffline(): boolean {
  return useConnectivity() === 'offline';
}
