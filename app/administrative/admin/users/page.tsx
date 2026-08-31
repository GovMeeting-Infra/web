import { requireRole, USER_ADMIN_ROLES, PLATFORM_ROLES } from '@/lib/session';
import { UsersView } from './UsersView';

// User administration is admin-only; the API refuses STAFF outright.
export default async function AdminUsersPage() {
  const user = await requireRole(USER_ADMIN_ROLES);
  return (
    <UsersView
      // Ministry-less viewers work across every ministry, so the form asks
      // which one rather than assuming their own.
      isPlatformRole={PLATFORM_ROLES.includes(user.systemRole)}
      isOwner={user.systemRole === 'SUPER_ADMIN'}
      // So the list can recognise the viewer's own row. Deactivating or
      // erasing yourself signs you out mid-request, and if you are your
      // ministry's only administrator it locks the ministry.
      currentUserId={user.id}
    />
  );
}
