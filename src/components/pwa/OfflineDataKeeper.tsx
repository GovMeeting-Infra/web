'use client';

import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from '@tanstack/react-query-persist-client';
import { isStandalone } from '@/lib/pwa/install';
import {
  OFFLINE_BUSTER,
  OFFLINE_MAX_AGE_MS,
  createOfflinePersister,
  shouldKeepQuery,
} from '@/lib/pwa/queryPersist';

/**
 * Keeps what the installed app reads, and puts it back when it next opens.
 *
 * The data half of offline reading; OfflinePageKeeper keeps the pages. Inside
 * the session, not at the root, because what is kept belongs to one person and
 * this is the first place that knows who.
 *
 * Nothing at all happens in a browser tab.
 *
 * Restored after the page's own queries start rather than before them. Online
 * that costs nothing — anything fetched is newer and hydrate keeps it. Offline
 * the phone reports it, React Query holds its fetches instead of failing them,
 * and the kept answers fill in a moment later.
 */
export function OfflineDataKeeper({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isStandalone()) return;
    const persister = createOfflinePersister(userId);
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    persistQueryClientRestore({
      queryClient,
      persister,
      maxAge: OFFLINE_MAX_AGE_MS,
      buster: OFFLINE_BUSTER,
    }).finally(() => {
      // Subscribed only after restoring, or the first save — of a cache still
      // empty — would overwrite what was about to be restored.
      if (cancelled) return;
      unsubscribe = persistQueryClientSubscribe({
        queryClient,
        persister,
        buster: OFFLINE_BUSTER,
        dehydrateOptions: { shouldDehydrateQuery: shouldKeepQuery },
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [queryClient, userId]);

  return children;
}
