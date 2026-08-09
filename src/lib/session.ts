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

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const authToken = cookieStore.get('authToken')?.value;

  if (!authToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE}/api/v1/auth/session`, {
      headers: { Cookie: `authToken=${authToken}` },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data.authenticated) {
      return null;
    }

    return data.user as CurrentUser;
  } catch {
    return null;
  }
}

export interface MyPreferences {
  emailNotifications: boolean;
  minutesNotifications: boolean;
  meetingReminders: boolean;
  actionItemNotifications: boolean;
  compactMode: boolean;
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
