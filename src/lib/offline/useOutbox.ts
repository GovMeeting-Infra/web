'use client';

import { useEffect, useState } from 'react';
import { listOps, listDead, subscribeToOutbox } from './outbox';
import type { DeadOp, OutboxOp } from './types';

export interface OutboxState {
  pending: OutboxOp[];
  dead: DeadOp[];
  /** True once the first read has completed, so nothing flashes an empty state. */
  ready: boolean;
}

const EMPTY: OutboxState = { pending: [], dead: [], ready: false };

/**
 * What is waiting to be sent, kept in step across tabs.
 *
 * Read into React state rather than through useSyncExternalStore because the
 * source is asynchronous — IndexedDB cannot answer during render, and the
 * getSnapshot contract requires that it could.
 */
export function useOutbox(): OutboxState {
  const [state, setState] = useState<OutboxState>(EMPTY);

  useEffect(() => {
    let cancelled = false;

    const read = async () => {
      const [pending, dead] = await Promise.all([listOps(), listDead()]);
      if (!cancelled) setState({ pending, dead, ready: true });
    };

    void read();
    const unsubscribe = subscribeToOutbox(() => void read());

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return state;
}
