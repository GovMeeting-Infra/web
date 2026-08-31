import { requireRole, PLATFORM_ROLES } from '@/lib/session';
import { PlatformHealthView } from './PlatformHealthView';

// The ministry-less roles only. Everything on this page is about the machine
// rather than about anyone's meetings, which is why it is the one administrative
// page an operations account can reach.
export default async function PlatformHealthPage() {
  await requireRole(PLATFORM_ROLES);
  return <PlatformHealthView />;
}
