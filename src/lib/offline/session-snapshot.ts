'use client';

import type { CurrentUser } from '@/lib/session';
import { idbGet, idbSet } from './db';
import { cacheNamespace } from './uid';

/**
 * Enough of the signed-in user to draw the workspace without asking the API.
 *
 * Deliberately small, and deliberately not a credential. Every question of what
 * this person may actually do is still answered by the server against the real
 * session cookie; this only decides what a sidebar says while the server cannot
 * be reached. Someone who edited this in their own browser would change the
 * name in their own header and nothing else.
 */
export interface SessionSnapshot {
  user: CurrentUser;
  ministryName: string | null;
  compact: boolean;
  savedAt: string;
}

const key = () => `${cacheNamespace()}:session`;

export function saveSessionSnapshot(
  snapshot: Omit<SessionSnapshot, 'savedAt'>,
): Promise<boolean> {
  return idbSet('session', key(), {
    ...snapshot,
    savedAt: new Date().toISOString(),
  });
}

export function readSessionSnapshot(): Promise<SessionSnapshot | null> {
  return idbGet<SessionSnapshot>('session', key());
}
