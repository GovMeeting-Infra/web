'use client';

import { useEffect, useState } from 'react';

/**
 * Registers the service worker, and gives it a way out.
 *
 * The build id rides in the query string because public/sw.js is served
 * verbatim and never sees build-time environment variables. Changing the URL is
 * what tells the browser this is a different worker; the worker reads the same
 * id back out of its own location to name its caches.
 */
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev';

const SW_URL = `/sw.js?v=${encodeURIComponent(BUILD_ID)}`;

/**
 * Clear cached pages when the person at the keyboard changes.
 *
 * Cached administrative HTML belongs to whoever was signed in when it was
 * stored, and a service worker cannot read an HttpOnly cookie to tell users
 * apart. So rather than have it guess, sign-in and sign-out both say "throw the
 * pages away" — leaving the cache holding only the current user's work. On the
 * tablet kept at a door, that is the difference between a convenience and a
 * disclosure.
 */
export function purgeCachedPages(): void {
  navigator.serviceWorker?.controller?.postMessage({ type: 'PURGE_PAGES' });
}

/**
 * Remove the worker and everything it has cached.
 *
 * A service worker is the one thing here that can break an app for people who
 * are not asking for help and cannot be reached: a bad one serves a stale shell
 * indefinitely, and "clear your site data" is not an instruction to give a
 * ministry over the phone. So the escape hatch ships with the first version
 * rather than after it is needed.
 */
export async function unregisterServiceWorker(): Promise<void> {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: 'UNREGISTER' });
    const registrations =
      await navigator.serviceWorker?.getRegistrations?.();
    await Promise.all((registrations ?? []).map((r) => r.unregister()));
  } catch {
    // Nothing registered, or the API is unavailable. Either way, done.
  }
}

export function ServiceWorkerRegistrar() {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Registering during load contention makes the first paint slower on
    // exactly the devices this is meant to help.
    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SW_URL, {
          scope: '/',
        });

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener('statechange', () => {
            // `controller` is null on the very first install; there is no old
            // version to replace, so there is nothing to tell anyone about.
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              setUpdateReady(true);
            }
          });
        });
      } catch {
        // A failed registration costs the offline features and nothing else.
        // The app must keep working for someone whose browser or policy
        // forbids service workers.
      }
    };

    if (document.readyState === 'complete') void register();
    else window.addEventListener('load', register, { once: true });

    return () => window.removeEventListener('load', register);
  }, []);

  if (!updateReady) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-center gap-3 border-t border-border bg-card p-3 text-sm text-foreground shadow-lg"
    >
      <span>A newer version of GovMeeting is ready.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Reload to update
      </button>
    </div>
  );
}
