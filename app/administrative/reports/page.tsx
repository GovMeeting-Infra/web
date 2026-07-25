import { requireRole, ADMIN_ROLES, getMinistryName } from '@/lib/session';
import { ReportsView } from './ReportsView';

// Ministry-wide analytics is admin information, and the API refuses STAFF
// outright — gate here so they reach /forbidden instead of an empty page.
export default async function ReportsPage() {
  const user = await requireRole(ADMIN_ROLES);

  const ministryName = await getMinistryName(user.ministryId, user.systemRole);
  const scopeLabel =
    user.systemRole === 'SUPER_ADMIN'
      ? 'All ministries'
      : (ministryName ?? 'Your ministry');

  return <ReportsView scopeLabel={scopeLabel} />;
}
