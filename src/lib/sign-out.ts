import { purgeOfflineData } from '@/lib/pwa/caches';

/**
 * Ends the session and leaves for the sign-in page.
 *
 * Shared by the sidebar button and the profile menu so the two cannot drift —
 * signing out from one place must do exactly what it does from the other.
 */
export async function signOut(): Promise<void> {
  try {
    await fetch('/api/v1/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // The session is what matters, and the server drops it on receipt. If the
    // request never landed, leaving the browser is still the right move.
  }

  // The same reasoning one layer down. Discarding the in-memory query cache is
  // not enough once a service worker is involved, because anything it stored
  // outlives the document, the tab and the browser being closed — on a shared
  // tablet that is the next person's problem rather than a stale render.
  //
  // Awaited rather than fired off: the redirect below tears this context down,
  // and a deletion that had not finished would simply not happen. It cannot
  // throw; every purge swallows its own failures, because failing to clear a
  // cache must not leave someone unable to sign out. Covers what the installed
  // app keeps for reading offline — stored pages and their data — as well.
  await purgeOfflineData();

  // A full document load, not router.push: the session is read by server
  // components, so a client-side navigation would keep rendering the cached
  // signed-in tree. This also discards any in-memory query cache, so the next
  // person to sign in cannot see the previous user's data.
  window.location.href = '/administrative/login';
}
