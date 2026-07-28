import { Suspense } from 'react';
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
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Loading…
        </div>
      }
    >
      <ResetPasswordView />
    </Suspense>
  );
}
