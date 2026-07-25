import { requireRole, ADMIN_ROLES } from '@/lib/session';
import { UsersView } from './UsersView';

// User administration is admin-only; the API refuses STAFF outright.
export default async function AdminUsersPage() {
  const user = await requireRole(ADMIN_ROLES);
  return <UsersView isSuperAdmin={user.systemRole === 'SUPER_ADMIN'} />;
}
