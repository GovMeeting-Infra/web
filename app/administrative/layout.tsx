import { ReactNode } from 'react';
import { AdminLayout } from '@/components/ui/admin-layout';
import { SessionProvider } from '@/components/SessionProvider';
import { PlatformTour } from '@/components/tour/PlatformTour';
import {
  getCurrentUser,
  getMinistryName,
  getMyPreferences,
} from '@/lib/session';

export default async function AdministrativeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  const [ministryName, preferences] = await Promise.all([
    user ? getMinistryName(user.ministryId, user.systemRole) : null,
    user ? getMyPreferences() : null,
  ]);

  return (
    <SessionProvider user={user}>
      <AdminLayout
        ministryName={ministryName ?? undefined}
        userName={user?.name}
        userEmail={user?.email}
        compact={preferences?.compactMode ?? false}
      >
        {children}
        {/* Mounted in the layout, not on a page: the tour walks between pages,
            so it has to survive each navigation. It renders nothing until it
            has a reason to run. */}
        {user && (
          <PlatformTour
            role={user.systemRole}
            firstName={user.name?.split(' ')[0] ?? 'there'}
            completedVersion={preferences?.tourCompletedVersion ?? null}
          />
        )}
      </AdminLayout>
    </SessionProvider>
  );
}
