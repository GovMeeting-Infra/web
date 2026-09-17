/**
 * Single source of truth for the client half of the PWA.
 *
 * Everything here is inlined at build time, so a value read from this module in
 * the browser is whatever the build that produced the bundle was told.
 */

/**
 * Versions the worker's caches and its script URL.
 *
 * Generated in next.config.ts and inlined from there. Note it is stamped in
 * development too, so it can never be used to tell a dev build from a
 * production one — NODE_ENV does that, and only that.
 */
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev';

/** Whether this build is allowed to register a worker at all. */
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Off unless a build was explicitly told otherwise, in production as well as in
 * development.
 *
 * Two reasons, and they are different. Production: a merge to main deploys
 * itself, and a service worker persists on user devices and answers before the
 * network, so one that ships by accident is genuinely hard to take back.
 * Development: `sw.js` serves /_next/static/ cache-first as immutable, which is
 * true of content-hashed production filenames and false of Turbopack's dev
 * chunk URLs — those get reused across recompiles, so the worker pins the first
 * copy it sees and the page ends up mixing chunks from two different compiles.
 * React's streaming client then throws `chunk.reason.enqueueModel is not a
 * function`, which names nothing to do with caching and survives reloads,
 * because the worker answers before the network does.
 */
export const SW_ENABLED = process.env.NEXT_PUBLIC_ENABLE_SW === '1' && IS_PRODUCTION;

/**
 * The worker sees only /administrative/*.
 *
 * This is what makes "staff tool" structural. The public calendar, the QR
 * check-in pages and the RSVP links are outside the scope, so the worker cannot
 * intercept them however wrong the code inside it gets — as opposed to an
 * exclusion list, which is only as good as whoever remembers to extend it when
 * a new public route appears.
 *
 * The script itself sits at the origin root, which is what permits it to claim
 * any scope at all; a worker can never take a scope above its own path.
 */
export const SW_SCOPE = '/administrative/';

/**
 * Nothing can be templated into a file in public/, so everything the worker
 * needs to know about the build that shipped it arrives in its own URL: the
 * cache version, and whether it may apply the cache-first rule above.
 *
 * A changed URL is also what makes the browser treat a deploy as an update.
 */
export const SW_URL = `/sw.js?v=${BUILD_ID}&env=${IS_PRODUCTION ? 'production' : 'development'}`;

/** Every cache this app owns. Anything else in Cache Storage is not ours. */
export const CACHE_PREFIXES = ['shell-', 'static-', 'pages-', 'meta-'] as const;

/** Page documents and their RSC payloads — the ones that can carry user data. */
export const PAGE_CACHE_PREFIX = 'pages-';

/**
 * Guards the single reload that follows a teardown. Without it, a teardown that
 * reloads into a page that tears down again is a loop the user cannot escape,
 * on a device where the worker answers before the network.
 */
export const TEARDOWN_RELOAD_KEY = 'pwa:torn-down';

/** Where the client asks whether the worker has been switched off remotely. */
export const SW_CONTROL_URL = '/sw-control';
