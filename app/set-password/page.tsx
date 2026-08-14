import { Suspense } from 'react';
import { AuthCardSkeleton } from '@/components/ui/skeletons';
import { SetPasswordView } from './SetPasswordView';

// Public: the recipient has no session yet — the invitation token is the
// credential. useSearchParams needs the Suspense boundary, as elsewhere.
export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center p-4">
          <AuthCardSkeleton label="Loading the form" />
        </div>
      }
    >
      <SetPasswordView />
    </Suspense>
  );
}
