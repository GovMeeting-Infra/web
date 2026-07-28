import { requireRole } from '@/lib/session';
import { ActivityLogView } from './ActivityLogView';

/**
 * Ministers see their own ministry's activity; super-admins see the whole
 * platform. Gated here as well as on the API so a staff member gets the
 * forbidden page rather than an empty screen and a 403 in the console.
 */
export default async function ActivityLogPage() {
  const user = await requireRole(['MINISTER', 'SUPER_ADMIN']);

  return <ActivityLogView isPlatformWide={user.systemRole === 'SUPER_ADMIN'} />;
}
