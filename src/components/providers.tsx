'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { isOffline } from '@/lib/api/client';

/**
 * Defaults the app had been running without.
 *
 * `new QueryClient()` with no options is not a neutral choice — it is a set of
 * choices, and three of them were wrong here. Written out so the next person
 * reading a caching bug can see what is actually in force.
 */
function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /**
         * Run against the cache rather than sitting in `paused`.
         *
         * The default, 'online', means a query started while the browser
         * believes it is offline never resolves and never errors: the page
         * shows its loading state indefinitely, with no message and no retry.
         * On the connections this app is used over that is the common case,
         * not the edge case.
         */
        networkMode: 'offlineFirst',
        /**
         * Off, and this is a bug fix rather than a preference.
         *
         * With the bare client this was on while staleTime was 0, so tabbing
         * away and back refetched everything immediately. The minutes editor
         * documents work being destroyed by exactly that (see the seeding
         * comment in events/[id]/minutes/page.tsx) and had to defend itself.
         * Pages that genuinely need to keep up ask for it with refetchInterval,
         * which several already do.
         */
        refetchOnWindowFocus: false,
        staleTime: 30_000,
        /**
         * Long enough that a cached page survives a lunch break and, once the
         * cache is persisted, a browser restart. Nothing is served from it
         * without a refetch behind the scenes.
         */
        gcTime: 7 * 24 * 60 * 60 * 1000,
        /**
         * Three retries with backoff is a long time to spend failing when the
         * connection is simply down, and the caller cannot show its offline
         * message until the last one lands. Retry a server that answered
         * badly; do not retry a network that is not there.
         */
        retry: (failureCount, error) => !isOffline(error) && failureCount < 2,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  /**
   * Per mount, not per module.
   *
   * At module scope the cache was created once for the life of the tab and
   * shared by every user who signed in during it — which sign-out worked
   * around by reloading the whole document. On a shared device that is the
   * wrong default to rely on.
   */
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {/* At the root rather than inside the admin shell: the sign-in, reset,
          check-in and guest pages are outside that shell and have tooltips of
          their own. Radix throws without a provider above them. */}
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}
