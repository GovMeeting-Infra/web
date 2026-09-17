'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { purgeAllPwaCaches } from '@/lib/pwa/caches';
import {
  SW_CONTROL_URL,
  SW_ENABLED,
  SW_SCOPE,
  SW_URL,
  TEARDOWN_RELOAD_KEY,
} from '@/lib/pwa/config';
import { UpdateToast } from './UpdateToast';

/** How often an open tab asks whether a new version has been deployed. */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
/** Floor between checks triggered by returning to the tab. */
const UPDATE_CHECK_THROTTLE_MS = 30 * 60 * 1000;

/**
 * Decides whether this browser should have a service worker, keeps it current,
 * and offers the update when one is ready.
 *
 * Mounted at the root rather than inside the admin shell. Registration only
 * matters for the workspace, but *removal* matters everywhere: someone whose
 * browser is holding a worker should be rescued by loading any page of this
 * site, not only the ones behind a sign-in they may no longer be able to
 * complete.
 */
export function ServiceWorkerManager() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);
  /**
   * Whether the reload about to happen is one the user asked for.
   *
   * `controllerchange` also fires the first time a worker claims this page,
   * which is an ordinary first install and must not reload anything. Only a
   * reload we initiated should act on it.
   */
  const updateRequested = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    let lastCheck = Date.now();
    let registration: ServiceWorkerRegistration | undefined;

    const offerIfWaiting = () => {
      // A waiting worker with no controller is a first install, not an update.
      if (!cancelled && registration?.waiting && navigator.serviceWorker.controller) {
        setWaiting(registration.waiting);
      }
    };

    const onControllerChange = () => {
      if (!updateRequested.current) return;
      window.location.reload();
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastCheck < UPDATE_CHECK_THROTTLE_MS) return;
      lastCheck = Date.now();
      void registration?.update();
    };

    void (async () => {
      // SW_ENABLED is false unless a build was explicitly told otherwise, in
      // production as well as in development, so this is the branch almost
      // every load takes today. No network request is made for it.
      if (!SW_ENABLED) {
        await teardown();
        return;
      }

      if (await isRemotelyDisabled()) {
        await teardown();
        return;
      }

      try {
        registration = await navigator.serviceWorker.register(SW_URL, {
          scope: SW_SCOPE,
          // Never let an HTTP cache answer for the worker script; a worker that
          // cannot be re-fetched cannot be updated or switched off.
          updateViaCache: 'none',
        });
      } catch {
        // A failed registration leaves the site working exactly as it does
        // without a worker, which is the point of the whole arrangement.
        return;
      }
      if (cancelled) return;

      // Already queued when this page loaded — a tab opened after the deploy.
      offerIfWaiting();

      registration.addEventListener('updatefound', () => {
        const installing = registration?.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed') offerIfWaiting();
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

      // Staff leave tabs open for days, so without these an open tab would sit
      // on the worker it started with until someone happened to hard-reload.
      document.addEventListener('visibilitychange', onVisible);
      interval = setInterval(() => {
        lastCheck = Date.now();
        void registration?.update();
      }, UPDATE_CHECK_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waiting) return;
    updateRequested.current = true;
    setWaiting(null);
    // The worker calls skipWaiting, activates, takes control, and the
    // controllerchange handler above reloads once.
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }, [waiting]);

  if (!waiting || dismissed) return null;

  return (
    <UpdateToast
      onUpdate={applyUpdate}
      // Hidden for this session only. The waiting worker stays waiting and
      // takes over on its own once every tab using the old one has closed, so
      // "Later" postpones the interruption rather than refusing the update.
      onDismiss={() => setDismissed(true)}
    />
  );
}

/**
 * Asks the server whether the worker has been switched off since this bundle
 * was built.
 *
 * Unreachable is not the same as disabled: failing closed would tear the worker
 * down on every device that lost its connection, which is the one moment it
 * exists to help.
 */
async function isRemotelyDisabled(): Promise<boolean> {
  try {
    const response = await fetch(SW_CONTROL_URL, { cache: 'no-store' });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    return (body as { disabled?: boolean }).disabled === true;
  } catch {
    return false;
  }
}

/**
 * Removes every worker and cache this app owns.
 *
 * Also the rescue path for a developer who once enabled the worker on purpose:
 * loading any page in `next dev` takes it away again, without their having to
 * know that is what went wrong.
 */
async function teardown(): Promise<void> {
  let unregisteredSomething = false;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      if (await registration.unregister()) unregisteredSomething = true;
    }
  } catch {
    /* nothing registered, or the API is unavailable */
  }

  await purgeAllPwaCaches();

  // Unregistering does not evict the worker from the page it is already
  // controlling, so this document may still be showing whatever that worker
  // served. One reload fixes it — and only one, because a reload into a page
  // that tears down again is a loop nobody can escape on a device where the
  // worker answers before the network.
  if (!unregisteredSomething && !navigator.serviceWorker.controller) return;
  if (alreadyReloaded()) return;
  markReloaded();
  window.location.reload();
}

function alreadyReloaded(): boolean {
  try {
    return window.sessionStorage.getItem(TEARDOWN_RELOAD_KEY) === '1';
  } catch {
    // Storage can be unavailable in private browsing. Treating that as "already
    // reloaded" gives up the refresh rather than risking the loop.
    return true;
  }
}

function markReloaded(): void {
  try {
    window.sessionStorage.setItem(TEARDOWN_RELOAD_KEY, '1');
  } catch {
    /* see alreadyReloaded */
  }
}
