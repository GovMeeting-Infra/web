import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AdminLayout } from '@/components/ui/admin-layout';
import { SessionProvider } from '@/components/SessionProvider';
import { PlatformTour } from '@/components/tour/PlatformTour';
import { SessionTimeoutWarning } from '@/components/ui/session-timeout-warning';
import { OfflineAdminShell } from '@/components/offline/OfflineAdminShell';
import { SessionSnapshotWriter } from '@/components/offline/SessionSnapshotWriter';
import { SyncProvider } from '@/components/offline/SyncProvider';
import {
  getSessionState,
  getMinistryName,
  getMyPreferences,
} from '@/lib/session';

export default async function AdministrativeLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSessionState();

  // No session, no shell. This used to render the whole administrative layout
  // with an empty user, so someone returning to an open tab got the sidebar,
  // the header and the page furniture — and then a message in the middle of it
  // saying their session had ended, on a screen where nothing worked. The
  // login page sits in the (auth) route group and does not inherit this
  // layout, so redirecting here cannot loop.
  //
  // Where the person was is added by the client (lib/api/client.ts), which
  // knows the address; a layout does not receive one.
  if (session.status === 'anonymous') {
    redirect('/administrative/login?reason=expired');
  }

  // Deliberately not a redirect. Sending someone to sign in because the API is
  // unreachable would blame them for an outage and hand them a login form that
  // cannot work either.
  //
  // No longer a dead end either. This branch is reached both when the browser
  // has no connection and when the API is down behind a working nginx, and in
  // either case the device usually already holds who is signed in and most of
  // what they were reading. The shell draws itself from that, and falls back to
  // the card below only when there is genuinely nothing.
  if (session.status === 'unavailable') {
    return <OfflineAdminShell>{children}</OfflineAdminShell>;
  }

  // Past both branches above, so there is definitely a user — the `user &&`
  // guards this markup used to carry are gone with the case they covered.
  const user = session.user;
  const [ministryName, preferences] = await Promise.all([
    getMinistryName(user.ministryId, user.systemRole),
    getMyPreferences(),
  ]);

  return (
    <SessionProvider user={user}>
      <AdminLayout
        ministryName={ministryName ?? undefined}
        userName={user.name}
        userEmail={user.email}
        compact={preferences?.compactMode ?? false}
      >
        {/* Leaves behind who is signed in, so the branch above has something to
            draw the workspace from next time the API cannot be asked. */}
        <SessionSnapshotWriter
          user={user}
          ministryName={ministryName}
          compact={preferences?.compactMode ?? false}
        />
        {/* Drains the queue and reports the two outcomes worth interrupting
            for. In the layout so it survives navigation — a sync that stopped
            every time someone changed page would never finish. */}
        <SyncProvider />
        {children}
        {/* Same reasoning as the tour: the clock has to survive navigation,
            and an inactivity sign-out can land on any page. */}
        <SessionTimeoutWarning />
        {/* Mounted in the layout, not on a page: the tour walks between pages,
            so it has to survive each navigation. It renders nothing until it
            has a reason to run. */}
        <PlatformTour
          role={user.systemRole}
          firstName={user.name?.split(' ')[0] ?? 'there'}
          completedVersion={preferences?.tourCompletedVersion ?? null}
        />
      </AdminLayout>
    </SessionProvider>
  );
}
