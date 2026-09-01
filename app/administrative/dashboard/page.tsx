import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { DashboardView } from './DashboardView';

/**
 * The dashboard is a meeting participant's home: upcoming events, their action
 * items, pending RSVPs. An operations account has none of those and the API
 * refuses it all three, so the page rendered three "couldn't load" panels and
 * blamed the connection.
 *
 * Sending them to their own overview instead, rather than /forbidden — this is
 * the default destination after signing in, and being bounced to a refusal on
 * arrival is a poor welcome for an account that is working correctly.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Only the operations role. The owner has no ministry either, but the API
  // answers it everywhere and the page already has branches for that case.
  if (user?.systemRole === 'PLATFORM_ADMIN') {
    redirect('/administrative/platform');
  }

  return <DashboardView />;
}
