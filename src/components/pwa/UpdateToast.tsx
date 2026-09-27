'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Offered when a new version of the app has been installed and is waiting.
 *
 * A prompt rather than a silent swap: reloading the page out from under someone
 * halfway through writing minutes would lose what they were typing, and this is
 * a system people use while a meeting is happening.
 */
export function UpdateToast({
  onUpdate,
  onDismiss,
}: {
  onUpdate: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      // polite, not assertive: worth knowing, never worth interrupting someone
      // mid-sentence to say.
      role="status"
      aria-live="polite"
      className={
        'fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 ' +
        // The root layout sets viewport-fit=cover precisely so these insets
        // resolve; without the padding this sits under the home indicator on
        // an iPhone, which is where the buttons are.
        'pb-[calc(1rem+env(safe-area-inset-bottom))]'
      }
    >
      <div className="flex w-full max-w-md items-center gap-3 rounded-[1.5rem] border border-border bg-card p-4 shadow-lg">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"
        >
          <RefreshCw className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">A new version is ready</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Reload when you are at a good stopping point.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Later
          </Button>
          <Button size="sm" onClick={onUpdate}>
            Reload
          </Button>
        </div>
      </div>
    </div>
  );
}
