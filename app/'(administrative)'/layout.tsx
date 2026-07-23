import { ReactNode } from 'react';
import { AdminLayout } from '@/components/ui/admin-layout';

export default function AdministrativeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AdminLayout
      ministryName="Ministry of Health"
      userName="John Doe"
      userEmail="john.doe@gov.sl"
    >
      {children}
    </AdminLayout>
  );
}
