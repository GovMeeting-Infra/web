import { requireRole, PLATFORM_ROLES } from '@/lib/session';
import { PlatformSettingsView } from './PlatformSettingsView';

// Distinct from /administrative/settings, which is a user's own preferences.
// These values apply to everyone on the platform, so they are limited to the
// roles that answer for the whole of it. The sign-in domain within the page is
// narrower still — see PlatformSettingsView.
export default async function PlatformSettingsPage() {
  await requireRole(PLATFORM_ROLES);
  return <PlatformSettingsView />;
}
