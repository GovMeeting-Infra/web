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

  // A full document load, not router.push: the session is read by server
  // components, so a client-side navigation would keep rendering the cached
  // signed-in tree. This also discards any in-memory query cache, so the next
  // person to sign in cannot see the previous user's data.
  window.location.href = '/login';
}
