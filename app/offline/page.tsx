import { PublicShell } from '@/components/PublicShell';
import { OfflineRetry } from '@/components/offline/OfflineRetry';

export const metadata = {
  title: 'You are offline',
};

/**
 * The last resort, shown when the service worker has nothing cached for where
 * the person was going.
 *
 * Deliberately public and static: it is precached during install, so it must
 * not need a session, an API call or anything the network would have to
 * provide. If this page needed any of those it would be blank at exactly the
 * moment it exists for.
 *
 * It says what is safe rather than only what is wrong. Someone who has just
 * lost a connection mid-meeting mostly wants to know whether their work is
 * gone.
 */
export default function OfflinePage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-xl py-12 text-center">
        <h1 className="text-2xl font-bold text-primary">
          You&rsquo;re offline
        </h1>
        <p className="mt-3 text-slate-600">
          This page hasn&rsquo;t been opened on this device before, so there
          isn&rsquo;t a copy saved here to show you.
        </p>
        <p className="mt-3 text-slate-600">
          Pages you have already visited will still open, and anything you typed
          without saving is still on this device. It will be here when the
          connection comes back.
        </p>
        <OfflineRetry />
        <p className="mt-8 text-sm text-slate-500">
          This page will start working again on its own — there is no need to
          sign in again.
        </p>
      </div>
    </PublicShell>
  );
}
