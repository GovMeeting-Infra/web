import { ReactNode } from 'react';
import { AdminLayout } from '@/components/ui/admin-layout';
import { SessionProvider } from '@/components/SessionProvider';
import { getCurrentUser, getMinistryName } from '@/lib/session';

export default async function AdministrativeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();
  const ministryName = user
    ? await getMinistryName(user.ministryId, user.systemRole)
    : null;

  return (
    <SessionProvider user={user}>
      <AdminLayout
        ministryName={ministryName ?? undefined}
        userName={user?.name}
        userEmail={user?.email}
      >
        {children}
      </AdminLayout>
    </SessionProvider>
  );
}
