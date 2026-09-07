'use client';

import { ReactNode, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/ui/admin-layout';
import { SessionProvider } from '@/components/SessionProvider';
import {
  readSessionSnapshot,
  type SessionSnapshot,
} from '@/lib/offline/session-snapshot';

/**
 * The workspace, drawn from what this device already knew.
 *
 * Reached when the server could not be asked who is signed in. Until now that
 * returned a card saying the service was unreachable, and the person lost the
 * sidebar, their place, and any way to read what they had already loaded —
 * which is most of what they wanted, and all of it already on the device.
 *
 * Two situations arrive here and only one is an outage: the browser has no
 * connection, or the API is down while nginx is up. Both look the same from
 * here, and the honest thing to say covers both.
 *
 * The session timeout warning and the guided tour are deliberately not
 * rendered. One would count down against a server it cannot reach and navigate
 * away from unsaved work; the other would walk someone through features that
 * are not currently answering.
 */
export function OfflineAdminShell({ children }: { children: ReactNode }) {
  /**
   * `undefined` while looking, `null` once we know there is nothing. The three
   * states matter: rendering the "no snapshot" card during the lookup would
   * flash it at everyone for whom this is about to work.
   */
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    void readSessionSnapshot().then((found) => {
      if (!cancelled) setSnapshot(found);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (snapshot === undefined) return null;

  if (!snapshot) return <NothingCached />;

  return (
    <SessionProvider user={snapshot.user}>
      <AdminLayout
        ministryName={snapshot.ministryName ?? undefined}
        userName={snapshot.user.name}
        userEmail={snapshot.user.email}
        compact={snapshot.compact}
      >
        {children}
      </AdminLayout>
    </SessionProvider>
  );
}

/**
 * Nobody has signed in on this device yet, so there is nothing to draw. Says
 * what is true rather than offering a sign-in form that cannot reach anything.
 */
function NothingCached() {
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
