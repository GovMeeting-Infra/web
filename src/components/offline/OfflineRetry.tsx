'use client';

import { useMemo, useSyncExternalStore } from 'react';

/**
 * Offers back the page the person was actually going to.
 *
 * The offline page is prerendered and cached once, so it cannot be told at
 * build time where anyone was headed. The service worker puts it in the address
 * instead (`/offline?from=...`) and this reads it there, on the client, at the
 * moment it is shown.
 *
 * Read from location rather than useSearchParams: this page has to stay
 * statically prerendered — it is precached and served when nothing else can be
 * — and useSearchParams would opt it into a Suspense boundary and dynamic
 * rendering, which is the one thing it must not need.
 */

/**
 * Nothing changes the address without also remounting this, so there is no
 * event to listen for. Same reasoning as lib/hooks/useDraftBackup.ts.
 */
const subscribeToNothing = () => () => {};

export function OfflineRetry() {
  /**
   * Read as an external store rather than copied into state by an effect. The
   * effect version needed a setState during mount, and the server snapshot is
   * empty, so nothing renders until the client does and no hydration mismatch
   * is possible.
   */
  const search = useSyncExternalStore(
    subscribeToNothing,
    () => window.location.search,
    () => '',
  );

  const from = useMemo(() => {
    const raw = new URLSearchParams(search).get('from');
    // Same-origin paths only. This value reaches an anchor's href, and an
    // absolute URL here would turn a cached page into an open redirect.
    return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : null;
  }, [search]);

  if (!from) return null;

  return (
    <div className="mt-8">
      <a
        href={from}
        className="inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Try that page again
      </a>
      <p className="mt-3 text-xs text-slate-500">
        You were going to <span className="font-mono">{from}</span>
      </p>
    </div>
  );
}
