import { requireRole, USER_ADMIN_ROLES, PLATFORM_ROLES } from '@/lib/session';
import { StaffImportView } from './StaffImportView';

// Same guard as the Users page it hangs off, so the sidebar entry that leads
// here and the page agree. The API refuses STAFF on every route it calls.
export default async function StaffImportPage() {
  const user = await requireRole(USER_ADMIN_ROLES);
  return (
    <StaffImportView
      // Platform roles belong to no ministry, so they choose one. Everybody
      // else uploads to their own and the API holds them to it.
      isPlatformRole={PLATFORM_ROLES.includes(user.systemRole)}
    />
  );
}
