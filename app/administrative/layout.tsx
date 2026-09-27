import { ReactNode, Suspense } from 'react';
import { redirect } from 'next/navigation';
import { AdminLayout } from '@/components/ui/admin-layout';
import { SessionProvider } from '@/components/SessionProvider';
import { PlatformTour } from '@/components/tour/PlatformTour';
import { SessionTimeoutWarning } from '@/components/ui/session-timeout-warning';
import { LaunchScreen } from '@/components/pwa/LaunchScreen';
import {
  getSessionState,
  getMinistryName,
  getMyPreferences,
} from '@/lib/session';

/**
 * Shown when the API cannot be reached at all, in place of the workspace.
 *
 * No sidebar and no navigation, because none of it would work — but no login
 * prompt either, because signing in is not the missing thing.
 */
function ServiceUnavailable() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-[1.5rem] border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-bold text-primary">
          We can&rsquo;t reach the service
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your sign-in is fine — the server behind this workspace is not
          answering right now. Nothing you have saved is affected.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Try again in a few minutes. If it keeps happening, tell your IT
          support that the meetings API is unreachable.
        </p>
      </div>
    </main>
  );
}

/**
 * Not async on purpose: everything that waits on the API happens below the
 * Suspense boundary, so the launch screen streams while it does.
 *
 * Before this the layout awaited the session and then the ministry and
 * preferences before returning anything, and no HTML at all was sent in that
 * time — an installed app opened onto a blank screen for as long as those round
 * trips took. Only full page loads see the fallback; navigating between pages
 * keeps this layout mounted, so there is no flash between them.
 *
 * A redirect() below a boundary that has already streamed cannot be a 307 any
 * more; Next turns it into a client-side redirect. The expired-session case
 * still lands on the login page, one hop later.
 */
export default function AdministrativeLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<LaunchScreen />}>
      <Workspace>{children}</Workspace>
    </Suspense>
  );
}

async function Workspace({ children }: { children: ReactNode }) {
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
  if (session.status === 'unavailable') {
    return <ServiceUnavailable />;
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
