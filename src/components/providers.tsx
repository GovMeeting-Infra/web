'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();

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
