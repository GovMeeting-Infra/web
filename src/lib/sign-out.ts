import { purgeDraftBackups } from '@/lib/hooks/useDraftBackup';
import { purgeCachedPages } from '@/components/offline/ServiceWorkerRegistrar';
import { cacheNamespace } from '@/lib/offline/uid';
import { idbPurgeNamespace } from '@/lib/offline/db';

/**
 * Ends the session and leaves for the sign-in page.
 *
 * Shared by the sidebar button and the profile menu so the two cannot drift —
 * signing out from one place must do exactly what it does from the other.
 *
 * Takes the user id so it can clear what belongs to them. A full reload drops
 * everything held in memory, but unsaved minutes are deliberately kept in
 * localStorage to survive a crash, and surviving a crash must not mean
 * surviving the person leaving a shared device.
 */
export async function signOut(userId?: string | null): Promise<void> {
  if (userId) purgeDraftBackups(userId);

  // Everything this device is holding on this person's behalf, before the
  // session cookie goes and the namespace becomes unreadable. Order matters:
  // cacheNamespace() reads the uidHint cookie, which the sign-out response
  // clears.
  const namespace = cacheNamespace();
  purgeCachedPages();
  await idbPurgeNamespace(namespace);

  try {
    await fetch('/api/v1/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // The session is what matters, and the server drops it on receipt. If the
    // request never landed, leaving the browser is still the right move.
  }

  // A full document load, not router.push: the session is read by server
  // components, so a client-side navigation would keep rendering the cached
  // signed-in tree. This also discards any in-memory query cache, so the next
  // person to sign in cannot see the previous user's data.
  window.location.href = '/administrative/login';
}
