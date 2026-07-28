import { ReactNode } from 'react';
import { AdminLayout } from '@/components/ui/admin-layout';
import { SessionProvider } from '@/components/SessionProvider';
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
      </AdminLayout>
    </SessionProvider>
  );
}
