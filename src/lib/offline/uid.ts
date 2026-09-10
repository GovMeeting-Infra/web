'use client';

/**
 * Which signed-in user this browser is currently caching for.
 *
 * The session cookie is HttpOnly, so nothing here can read it — which is the
 * right call for a credential and the wrong situation for a cache. Once pages
 * and API responses are stored on disk, something has to be able to say whose
 * they are, or the shared tablet at the door will serve the last person's
 * meetings to the next one.
 *
 * So the API sets a second cookie beside the session: opaque, readable, and
 * authorising nothing (server/src/auth/uid-hint.util.ts). It is only ever used
 * as a namespace. Never treat its presence as proof of a session — the real
 * cookie can expire while this one is still sitting in the jar.
 */
export const UID_HINT_COOKIE = 'uidHint';

/** The tag for the current user, or null when nobody is signed in here. */
export function readUidHint(): string | null {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${UID_HINT_COOKIE}=([^;]*)`),
  );
  if (!match) return null;

  const value = decodeURIComponent(match[1]).trim();
  // Anything unexpected is treated as absent rather than used as a key: a
  // stray value would silently create a namespace nothing ever cleans up.
  return /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value : null;
}

/**
 * The namespace to file cached data under.
 *
 * Signed-out browsing is still cached — the public calendar, the check-in page
 * — so there has to be a bucket for it, and it must be a different bucket from
 * anyone's.
 */
export function cacheNamespace(): string {
  return readUidHint() ?? 'anon';
}
