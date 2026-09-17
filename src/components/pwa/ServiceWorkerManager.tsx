'use client';

import { useEffect } from 'react';
import { purgeAllPwaCaches } from '@/lib/pwa/caches';
import {
  SW_CONTROL_URL,
  SW_ENABLED,
  SW_SCOPE,
  SW_URL,
  TEARDOWN_RELOAD_KEY,
} from '@/lib/pwa/config';

/**
 * Decides whether this browser should have a service worker, and makes it so.
 *
 * Mounted at the root rather than inside the admin shell. Registration only
 * matters for the workspace, but *removal* matters everywhere: someone whose
 * browser is holding a worker should be rescued by loading any page of this
 * site, not only the ones behind a sign-in they may no longer be able to
 * complete.
 *
 * Renders nothing.
 */
export function ServiceWorkerManager() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

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
        await navigator.serviceWorker.register(SW_URL, {
          scope: SW_SCOPE,
          // Never let an HTTP cache answer for the worker script; a worker that
          // cannot be re-fetched cannot be updated or switched off.
          updateViaCache: 'none',
        });
      } catch {
        // A failed registration leaves the site working exactly as it does
        // without a worker, which is the point of the whole arrangement.
      }
    })();
  }, []);

  return null;
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
