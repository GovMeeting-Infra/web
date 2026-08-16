import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { STAFF_ROLES, ADMIN_ROLES, type SystemRole } from './roles';
import { API_BASE } from './api-base';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  systemRole: 'SUPER_ADMIN' | 'MINISTER' | 'MINISTRY_ADMIN' | 'STAFF';
  jobTitle: string | null;
  ministryId: string | null;
}

/**
 * Why there is no user, which is not always the same question as whether there
 * is one.
 *
 * `anonymous` means the API answered and said nobody is signed in. `unavailable`
 * means we could not ask — the API is down, unreachable, or erroring. Both used
 * to collapse into `null`, which is the right answer for a public page deciding
 * whether to show a guest form, and the wrong one for the administrative layout:
 * treating an outage as a signed-out session would send every working user to a
 * login page, blaming an expired session for a server being down and sending
 * them to sign in again against the same dead API.
 */
export type SessionState =
  | { status: 'authenticated'; user: CurrentUser }
  | { status: 'anonymous' }
  | { status: 'unavailable' };

export async function getSessionState(): Promise<SessionState> {
  const cookieStore = await cookies();
  const authToken = cookieStore.get('authToken')?.value;

  if (!authToken) {
    return { status: 'anonymous' };
  }

  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/session`, {
      headers: { Cookie: `authToken=${authToken}` },
      cache: 'no-store',
    });

    // 401/403 is an answer: the token is no longer good. A 5xx is not.
    if (response.status >= 500) {
      return { status: 'unavailable' };
    }
    if (!response.ok) {
      return { status: 'anonymous' };
    }

    const data = await response.json();
    if (!data.authenticated) {
      return { status: 'anonymous' };
    }

    return { status: 'authenticated', user: data.user as CurrentUser };
  } catch {
    // Never reached the API at all.
    return { status: 'unavailable' };
  }
}

/**
 * The support address a super admin has configured, or an empty string.
 *
 * Rides on the session endpoint, which already carries the other platform
 * setting the app needs (the inactivity window). Empty is a real answer, not a
 * failure: the help page renders a different, honest ending when there is no
 * address rather than printing one that bounces.
 */
export async function getSupportEmail(): Promise<string> {
  const cookieStore = await cookies();
  const authToken = cookieStore.get('authToken')?.value;
  if (!authToken) return '';

  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/session`, {
      headers: { Cookie: `authToken=${authToken}` },
      cache: 'no-store',
    });
    if (!response.ok) return '';
    const data = await response.json();
    return typeof data.supportEmail === 'string' ? data.supportEmail : '';
  } catch {
    return '';
  }
}

/**
 * The user, or null for any reason at all.
 *
 * Kept for the public surfaces — check-in, RSVP, the public calendar — where
 * "we could not confirm a session" and "there is no session" both correctly
 * mean "treat this person as a guest".
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const state = await getSessionState();
  return state.status === 'authenticated' ? state.user : null;
}

export interface MyPreferences {
  emailNotifications: boolean;
  minutesNotifications: boolean;
  meetingReminders: boolean;
  actionItemNotifications: boolean;
  compactMode: boolean;
  /**
   * Guided tour version this user finished or dismissed; null if never shown.
   * Read by the layout so the tour can decide before the first paint, rather
   * than flashing on screen for someone who has already seen it.
   */
  tourCompletedVersion: string | null;
}

/**
 * The signed-in user's preferences, for settings the server-rendered shell has
 * to know about before painting — currently just compact mode.
 *
 * Returns null rather than throwing: a preferences lookup failing should render
 * the default layout, not break the page.
 */
export async function getMyPreferences(): Promise<MyPreferences | null> {
  const cookieStore = await cookies();
  const authToken = cookieStore.get('authToken')?.value;

  if (!authToken) return null;

  try {
    const response = await fetch(`${API_BASE}/api/v1/me/preferences`, {
      headers: { Cookie: `authToken=${authToken}` },
      cache: 'no-store',
    });

    if (!response.ok) return null;
    return (await response.json()) as MyPreferences;
  } catch {
    return null;
  }
}

// Re-exported so existing server-side imports keep working. The definitions
// live in lib/roles.ts because this module imports next/headers, which makes it
// unusable from a client component.
export type { SystemRole };
export { STAFF_ROLES, ADMIN_ROLES };

/**
 * Page-level role gate for server components. Redirects to /forbidden rather
 * than rendering an empty page when the API would refuse anyway.
 *
 * Note: with the current four roles, STAFF_ROLES covers every signed-in user,
 * so requireRole(STAFF_ROLES) only ever catches a missing session. It becomes
 * meaningful if a lower-privilege role is ever added.
 */
export async function requireRole(allowed: SystemRole[]): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/administrative/login');
  }

  if (!allowed.includes(user.systemRole)) {
    redirect('/administrative/forbidden');
  }

  return user;
}

export async function getMinistryName(
  ministryId: string | null,
  systemRole: CurrentUser['systemRole'],
): Promise<string | null> {
  if (!ministryId) return null;
  if (systemRole !== 'SUPER_ADMIN' && systemRole !== 'MINISTRY_ADMIN') {
    return null;
  }

  const cookieStore = await cookies();
  const authToken = cookieStore.get('authToken')?.value;
  if (!authToken) return null;

  try {
    const response = await fetch(
      `${API_BASE}/api/v1/admin/ministries/${ministryId}`,
      {
        headers: { Cookie: `authToken=${authToken}` },
        cache: 'no-store',
      },
    );
    if (!response.ok) return null;
    const ministry = await response.json();
    return ministry.name ?? null;
  } catch {
    return null;
  }
}
