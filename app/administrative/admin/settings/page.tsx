import { requireRole } from '@/lib/session';
import { PlatformSettingsView } from './PlatformSettingsView';

// Distinct from /administrative/settings, which is a user's own preferences.
// These two values apply to everyone on the platform, so super-admin only.
export default async function PlatformSettingsPage() {
  await requireRole(['SUPER_ADMIN']);
  return <PlatformSettingsView />;
}
