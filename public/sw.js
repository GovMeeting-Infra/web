/*
 * GovMeeting service worker.
 *
 * Written by hand rather than generated. Serwist is the usual answer, and the
 * Next PWA guide shipped with this version says plainly that it "currently
 * requires webpack configuration" — while Turbopack is this version's default
 * bundler for both dev and build. A webpack plugin would be silently ignored,
 * and finding that out from a stale production shell is not the way to find it
 * out.
 *
 * What it does, and just as importantly what it refuses to do:
 *
 *  - Static build output is immutable and cached forever, keyed by URL hash.
 *  - Navigations and RSC payloads are network-first with a short timeout, then
 *    cache, then an offline page. This is what makes the workspace open at all
 *    when the uplink is down.
 *  - /api/* is NEVER touched. React Query owns that data and persists it
 *    itself. Two caches over the same bytes with different freshness rules is
 *    how a list ends up showing a meeting the detail page has never heard of.
 *  - Nothing but GET, and nothing cross-origin. The banner upload goes straight
 *    to Cloudinary and must pass through untouched.
 *
 * Versioning: the page registers this as /sw.js?v=<build id>, so a deploy
 * changes the script URL and the browser treats it as a new worker. Every cache
 * name carries that same id, and activate deletes anything that does not. On a
 * single box with no CDN, a shell that outlives its deploy is invisible to
 * everyone and impossible to clear remotely, so this is the safety belt.
 */

const VERSION =
  new URL(self.location.href).searchParams.get('v') || 'dev';

const CACHE = {
  assets: `assets-${VERSION}`,
  pages: `pages-${VERSION}`,
};

/** Shown when a navigation has no cached copy to fall back on. */
const OFFLINE_URL = '/offline';

/** Give up on the network well before the browser would, then use the cache. */
const NETWORK_TIMEOUT_MS = 3000;

/**
 * Store a document along with the build output it references.
 *
 * Caching the HTML alone is not enough and fails in a way that looks like
 * something else entirely: the page is served, React starts, and the first
 * chunk it wants is not there, so a ChunkLoadError takes down the tree and the
 * person sees the generic "something went wrong" screen. Which is a lie — the
 * situation is that they have no connection, which is exactly what this page
 * exists to say.
 *
 * The asset list is read out of the markup rather than hardcoded, because these
 * filenames are content hashes that change on every build.
 */
async function precacheDocument(path) {
  const response = await fetch(path, { cache: 'reload' });
  if (!response.ok) return;

  const pages = await caches.open(CACHE.pages);
  await pages.put(path, response.clone());

  const html = await response.text();
  const refs = new Set();
  for (const match of html.matchAll(
    /(?:src|href)="(\/_next\/static\/[^"]+)"/g,
  )) {
    refs.add(match[1]);
  }

  const assets = await caches.open(CACHE.assets);
  // Individually, not addAll: one asset 404ing must not throw away the rest,
  // and a half-precached offline page is still better than none.
  await Promise.allSettled(
    [...refs].map(async (ref) => {
      const asset = await fetch(ref, { cache: 'reload' });
      if (asset.ok) await assets.put(ref, asset);
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await precacheDocument(OFFLINE_URL);
      // Take over as soon as the new worker is ready rather than waiting for
      // every tab to close. Paired with clients.claim below.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set(Object.values(CACHE));
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * Messages from the page.
 *
 * PURGE_PAGES is the whole of the shared-device story. Cached administrative
 * HTML belongs to whoever was signed in when it was stored, and this worker
 * cannot read the session cookie to tell users apart. Rather than guess, the
 * page clears the page cache whenever the person changes — on sign-in and on
 * sign-out — so it only ever holds the current user's pages.
 *
 * UNREGISTER is the kill switch. If a bad worker ever ships, this is how it is
 * removed without asking people to dig through browser settings.
 */
self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;

  if (type === 'PURGE_PAGES') {
    event.waitUntil(
      (async () => {
        await caches.delete(CACHE.pages);
        // Put the fallback straight back; losing it would turn every offline
        // navigation into the browser's own error page.
        await precacheDocument(OFFLINE_URL);
      })(),
    );
  }

  if (type === 'UNREGISTER') {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
        await self.registration.unregister();
      })(),
    );
  }
});

/** Immutable build output: the URL changes when the bytes do. */
function isBuildAsset(url) {
  return url.pathname.startsWith('/_next/static/');
}

/** Our own icons and images. Safe to serve stale, cheap to revalidate. */
function isStaticFile(url) {
  return (
    url.pathname.startsWith('/icons/') ||
    /\.(?:png|jpe?g|svg|webp|ico|woff2?)$/i.test(url.pathname)
  );
}

/**
 * A React Server Component payload — what an in-app <Link> fetches instead of
 * a document.
 */
function isRscRequest(request, url) {
  return (
    url.searchParams.has('_rsc') || request.headers.get('RSC') === '1'
  );
}

/** Routes that must never be served from a cache. */
function isNeverCached(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/administrative/login') ||
    // A check-in token lives five minutes. A cached copy of the page built
    // around one is worse than no copy at all.
    url.pathname.startsWith('/checkin/')
  );
}

/**
 * Match ignoring the query string, so /offline answers /offline?from=... too.
 */
function matchOffline() {
  return caches.match(OFFLINE_URL, { ignoreSearch: true });
}

async function fromNetworkFirst(request, cacheName, { fallback } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);

    // Only store a real, complete answer. A redirect to the login page is the
    // session ending, and caching it would pin everyone to sign-in.
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      caches.open(cacheName).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch {
    clearTimeout(timer);

    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error('offline and nothing cached');
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin is somebody else's business — Cloudinary uploads above all.
  if (url.origin !== self.location.origin) return;

  if (isNeverCached(url)) return;

  if (isBuildAsset(url)) {
    event.respondWith(
      caches.open(CACHE.assets).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (isStaticFile(url)) {
    event.respondWith(
      fromNetworkFirst(request, CACHE.assets).catch(
        () => new Response('', { status: 504 }),
      ),
    );
    return;
  }

  if (isRscRequest(request, url)) {
    /*
     * A 503, deliberately, when there is nothing cached.
     *
     * The router treats a failed RSC fetch as a reason to fall back to a full
     * document navigation — which this worker can answer out of the page cache.
     * Returning a synthesised or partial payload instead would leave the router
     * believing it had rendered something.
     */
    event.respondWith(
      fromNetworkFirst(request, CACHE.pages).catch(
        () => new Response('', { status: 503 }),
      ),
    );
    return;
  }

  if (request.mode === 'navigate') {
    /*
     * The offline page asking for itself. Serve it; never redirect.
     *
     * It is reached as /offline?from=..., and a cache lookup is exact about
     * query strings, so the plain /offline that was precached does not match.
     * Without this branch the miss falls through to the redirect below and
     * points the browser at /offline?from=/offline?from=... until Chrome gives
     * up with ERR_TOO_MANY_REDIRECTS — turning every uncached page into a dead
     * end instead of an explanation.
     */
    if (url.pathname === OFFLINE_URL) {
      event.respondWith(
        fetch(request).catch(
          async () =>
            (await matchOffline()) ||
            new Response('', { status: 503 }),
        ),
      );
      return;
    }

    event.respondWith(
      fromNetworkFirst(request, CACHE.pages).catch(async () => {
        /*
         * Redirect to the offline page rather than serve its body here.
         *
         * Returning that document under the requested address looked right and
         * was not: the router then hydrates a payload for one route against the
         * markup of another, and what the person actually sees is the generic
         * "something went wrong" screen — an error, for the ordinary situation
         * of having no connection. Redirecting keeps the address and the markup
         * describing the same page.
         *
         * Where they were going is carried along so the page can offer it back
         * when the connection returns.
         */
        const target = `${OFFLINE_URL}?from=${encodeURIComponent(
          url.pathname + url.search,
        )}`;

        // Only redirect if the destination is actually there; a redirect to a
        // page we cannot serve either would loop.
        if (await matchOffline()) return Response.redirect(target, 302);

        return new Response(
          '<!doctype html><meta charset="utf-8"><title>Offline</title><p>You are offline.',
          { status: 503, headers: { 'Content-Type': 'text/html' } },
        );
      }),
    );
  }
});
