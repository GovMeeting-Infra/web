'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCurrentUser } from '@/components/SessionProvider';
import { isStandalone } from '@/lib/pwa/install';

/**
 * Asks the service worker to keep each page the installed app shows, so it
 * opens again with no connection.
 *
 * From the page because only the page knows two things the worker cannot:
 * that it is running as the installed app (browser tabs keep nothing — see
 * CACHE_AUTHENTICATED_PAGES in public/sw.js), and which page is on screen after
 * a client-side navigation, which never reaches the worker as a document.
 *
 * Tells the worker who is signed in first. A different person than last time
 * makes it drop every stored page before storing this one.
 */
export function OfflinePageKeeper() {
  // useSearchParams needs a boundary of its own, or it opts the whole layout
  // out of streaming.
  return (
    <Suspense fallback={null}>
      <Keeper />
    </Suspense>
  );
}

function Keeper() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const userId = useCurrentUser()?.id;

  useEffect(() => {
    if (!userId || !isStandalone() || !('serviceWorker' in navigator)) return;
    const url = search ? `${pathname}?${search}` : pathname;
    let cancelled = false;
    // ready rather than controller: on the first load after installing, the
    // worker is active before it controls this page.
    navigator.serviceWorker.ready
      .then((registration) => {
        const worker = registration.active;
        if (cancelled || !worker) return;
        worker.postMessage({ type: 'SET_USER', id: userId });
        worker.postMessage({ type: 'KEEP_PAGE', url });
      })
      .catch(() => {
        /* no worker, nothing to keep */
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, search, userId]);

  return null;
}
