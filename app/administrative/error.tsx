'use client';

import { useEffect } from 'react';

/**
 * Catches a render failure inside the workspace without taking the shell with
 * it.
 *
 * The only boundaries in the app were global-error and not-found, so anything
 * thrown while rendering an administrative page replaced the entire document
 * with the root-level fallback — sidebar, navigation and all. Here the person
 * keeps the shell, keeps their place, and gets something to press.
 *
 * Deliberately does not mention connections: an error that reaches this
 * boundary came back from the server, so the network is working.
 */
export default function AdministrativeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Administrative page failed to render', error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto max-w-lg rounded-[1.5rem] border border-border bg-card p-8 text-center"
    >
      <h1 className="text-lg font-bold text-primary">
        This page didn&rsquo;t load
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Something went wrong putting it together. Nothing you have saved is
        affected.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Try again
      </button>
      {error.digest && (
        <p className="mt-4 text-xs text-muted-foreground">
          Give support this reference: {error.digest}
        </p>
      )}
    </div>
  );
}
