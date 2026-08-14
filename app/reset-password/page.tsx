import { Suspense } from 'react';
import { AuthCardSkeleton } from '@/components/ui/skeletons';
import { ResetPasswordView } from './ResetPasswordView';

export const metadata = {
  title: 'Reset your password',
  robots: { index: false, follow: false },
};

// Public: whoever follows the link has no session — the reset token is the
// credential. useSearchParams needs the Suspense boundary, as elsewhere.
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center p-4">
          <AuthCardSkeleton label="Loading the reset form" />
        </div>
      }
    >
      <ResetPasswordView />
    </Suspense>
  );
}
