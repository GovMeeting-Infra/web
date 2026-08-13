import { Suspense } from 'react';
import { SetPasswordView } from './SetPasswordView';

// Public: the recipient has no session yet — the invitation token is the
// credential. useSearchParams needs the Suspense boundary, as elsewhere.
export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-slate-500">
          Loading…
        </div>
      }
    >
      <SetPasswordView />
    </Suspense>
  );
}
