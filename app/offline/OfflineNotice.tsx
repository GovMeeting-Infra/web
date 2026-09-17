'use client';

import { useCallback, useSyncExternalStore } from 'react';

const STANDALONE = '(display-mode: standalone)';

function subscribeToDisplayMode(onChange: () => void) {
  const mq = window.matchMedia(STANDALONE);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/**
 * `navigator.standalone` as well as the media query: it is non-standard and
 * iOS-only, and it is also the only signal iOS gives for a copy launched from
 * the home screen.
 */
function isStandalone() {
  return (
    window.matchMedia(STANDALONE).matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Where "Try again" should go.
 *
 * `from` arrives in the URL, which means it arrives from whoever wrote the
 * link. Handing it to location.replace() unchecked would make this page an open
 * redirect on a government domain, and `javascript:` would make it worse than
 * that — so only a same-origin absolute path is accepted. A leading `//` is
 * rejected explicitly because `//evil.example` is a protocol-relative URL to
 * somewhere else, not a path on this site.
 */
function safeReturnPath(search: string): string | null {
  const from = new URLSearchParams(search).get('from');
  if (!from || !from.startsWith('/') || from.startsWith('//')) return null;
  return from;
}

/**
 * Styled inline, in the manner of app/global-error.tsx.
 *
 * The service worker precaches this document and serves it when nothing can be
 * fetched, so it has to stand up with no stylesheet, no font and no provider
 * tree. Anything referenced by URL is one more thing that must already be
 * cached, and one more way for the page whose whole job is to explain a failure
 * to fail in turn.
 */
export function OfflineNotice() {
  const standalone = useSyncExternalStore(
    subscribeToDisplayMode,
    isStandalone,
    // The server cannot know, and this is prerendered. False keeps the markup
    // it renders identical to the client's first pass.
    () => false,
  );

  const retry = useCallback(() => {
    const from = safeReturnPath(window.location.search);
    if (from) {
      window.location.replace(from);
    } else if (window.location.pathname !== '/offline') {
      // The worker serves this body under the URL that was actually asked for,
      // so in the ordinary case reloading retries that very page.
      window.location.reload();
    } else {
      window.location.replace('/administrative/dashboard');
    }
  }, []);

  return (
    <main style={{ maxWidth: '32rem', padding: '2rem', textAlign: 'center' }}>
      {/* A plain img rather than next/image on purpose: next/image would emit a
          /_next/image?... URL, which is one more request to have precached
          before a page for people with no connection can draw itself. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon-192.png"
        alt=""
        width={72}
        height={72}
        style={{ display: 'block', margin: '0 auto', borderRadius: '18px' }}
      />
      <p
        style={{
          margin: '1.25rem 0 0',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#007236',
        }}
      >
        Government of Sierra Leone
      </p>
      <h1 style={{ margin: '0.75rem 0 0', fontSize: '1.5rem', fontWeight: 700, color: '#003580' }}>
        You are offline
      </h1>
      <p style={{ margin: '0.75rem 0 0', color: '#475569', lineHeight: 1.6 }}>
        This device has no connection, so the workspace cannot be loaded. Nothing
        you have already saved is lost.
      </p>

      <button
        type="button"
        onClick={retry}
        style={{
          marginTop: '1.5rem',
          cursor: 'pointer',
          borderRadius: '999px',
          border: 'none',
          backgroundColor: '#003580',
          color: '#ffffff',
          padding: '0.7rem 1.5rem',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}
      >
        Try again
      </button>

      {/* An installed copy launches straight at the dashboard, so with the
          connection down this page is the first and only thing its owner sees —
          which reads as "the app I was told to install is worse than the
          website". The public calendar comes from the same cache and does work,
          so there is somewhere to send them. */}
      {standalone && (
        <p style={{ margin: '1.25rem 0 0', fontSize: '0.875rem' }}>
          <a href="/public-calendar" style={{ color: '#003580', fontWeight: 600 }}>
            Open the public calendar
          </a>
        </p>
      )}
    </main>
  );
}
