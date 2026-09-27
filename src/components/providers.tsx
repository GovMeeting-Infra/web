'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { isOffline } from '@/lib/api/client';
import { isStandalone } from '@/lib/pwa/install';
import { OFFLINE_MAX_AGE_MS } from '@/lib/pwa/queryPersist';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // An unreachable server is not going to answer the second or third time
      // in the next few seconds, and retrying keeps an offline page spinning
      // instead of showing what the device already has.
      retry: (failureCount, error) => !isOffline(error) && failureCount < 3,
      // The installed app keeps what it reads for a week (OfflineDataKeeper),
      // and a query dropped from memory is dropped from what is kept at the
      // next save. Everywhere else the default five minutes stands. Decided
      // once, here, because this module runs before anything renders.
      ...(typeof window !== 'undefined' && isStandalone()
        ? { gcTime: OFFLINE_MAX_AGE_MS }
        : {}),
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* At the root rather than inside the admin shell: the sign-in, reset,
          check-in and guest pages are outside that shell and have tooltips of
          their own. Radix throws without a provider above them. */}
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}
