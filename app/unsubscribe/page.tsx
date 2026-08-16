import { Suspense } from 'react';
import { AuthCardSkeleton } from '@/components/ui/skeletons';
import { UnsubscribeView } from './UnsubscribeView';

export const metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
};

// Public: whoever follows the link has no session, and may have no account at
// all — action items can be owned by people outside the ministry, and they
// receive the summary too. The signature in the link is the credential.
// useSearchParams needs the Suspense boundary, as elsewhere.
export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center p-4">
          <AuthCardSkeleton label="Loading" />
        </div>
      }
    >
      <UnsubscribeView />
    </Suspense>
  );
}
