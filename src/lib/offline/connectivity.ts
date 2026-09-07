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

interface ConnectivityStore {
  /**
   * Starts optimistic. The alternative is showing an offline banner to everyone
   * for the first few hundred milliseconds of every page load, which trains
   * people to ignore it.
   */
  state: Connectivity;
  /**
   * Whether a real request has settled yet.
   *
   * Until one has, `navigator.onLine` is the only thing to go on. After one
   * has, it is no longer worth consulting: a request that reached the server is
   * proof, and the browser's opinion is a guess about an interface. They
   * disagree more often than they should — a laptop behind a captive portal, a
   * machine woken from sleep, a profile that has got itself confused — and when
   * they do, the evidence wins. Otherwise someone whose saves are landing
   * perfectly well is told their work cannot be sent.
   */
  hasEvidence: boolean;
  listeners: Set<() => void>;
}

/**
 * Hung off globalThis rather than kept in module scope, and this is not
 * belt-and-braces — module scope was tried and was wrong.
 *
 * A bundler is free to place this module in more than one chunk, and when it
 * does, each copy gets its own variables. That happened here: the shell's
 * banner and a page rendered inside it ended up holding separate states, so the
 * banner said the device was offline while the page it framed said the opposite
 * — on the same screen, at the same moment. Nothing about the code looked
 * wrong, because nothing was: `let state` simply does not mean one state.
 *
 * A single well-known key does. Anything that must be true app-wide belongs
 * here rather than in a module variable.
 */
const KEY = '__govmeeting_connectivity__';

function store(): ConnectivityStore {
  const host = globalThis as Record<string, unknown>;
  if (!host[KEY]) {
    host[KEY] = {
      state: 'online',
      hasEvidence: false,
      listeners: new Set<() => void>(),
    } satisfies ConnectivityStore;
  }
  return host[KEY] as ConnectivityStore;
}

/**
 * Change the store, and tell subscribers only if the answer actually changed.
 *
 * Comparing the computed answer rather than the raw state, which is the whole
 * point and was got wrong once already. The verdict depends on two fields, not
 * one: `state` and whether any evidence has arrived. A first successful request
 * flips `hasEvidence` from false to true while leaving `state` on its initial
 * 'online' — so a version of this that compared `state` alone saw no change and
 * stayed silent, while the answer had gone from offline to online. The banner
 * kept its first snapshot and told people they were offline for as long as the
 * page was open, with every request succeeding behind it.
 */
function update(mutate: (current: ConnectivityStore) => void): void {
  const current = store();
  const before = snapshot();
  mutate(current);
  if (snapshot() === before) return;
  current.listeners.forEach((notify) => notify());
}

function set(next: Connectivity): void {
  update((current) => {
    current.state = next;
  });
}

/**
 * A request just came back from the server, so the connection is real.
 *
 * Called on every success, including error responses: a 403 travelled the whole
 * way there and back, which is exactly the proof wanted here.
 */
export function reportReachable(): void {
  update((current) => {
    current.hasEvidence = true;
    current.state = 'online';
  });
}

/**
 * A request failed in a way that means it never arrived — a dropped connection
 * or our own timeout, not an answer we disliked.
 */
export function reportUnreachable(): void {
  update((current) => {
    current.hasEvidence = true;
    current.state = 'offline';
  });
}

/** True when the browser is certain there is no network at all. */
function browserSaysOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function subscribe(onChange: () => void): () => void {
  store().listeners.add(onChange);

  /*
   * Both are hints, and neither is the last word.
   *
   * `offline` is usually right and worth acting on at once — it is what makes
   * the banner appear the moment a cable is pulled rather than at the next
   * request. It is still only a hint: a successful request overrules it.
   */
  const goOffline = () => set('offline');
  const goOnline = () => set('online');

  window.addEventListener('offline', goOffline);
  window.addEventListener('online', goOnline);

  return () => {
    store().listeners.delete(onChange);
    window.removeEventListener('offline', goOffline);
    window.removeEventListener('online', goOnline);
  };
}

function snapshot(): Connectivity {
  const current = store();
  // Before anything has been tried, the browser's opinion is all there is.
  // Afterwards it is outranked by what actually happened.
  if (!current.hasEvidence && browserSaysOffline()) return 'offline';
  return current.state;
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
