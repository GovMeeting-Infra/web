'use client';

import { useEffect } from 'react';
import type { CurrentUser } from '@/lib/session';
import { saveSessionSnapshot } from '@/lib/offline/session-snapshot';

/**
 * Records who is signed in, so the workspace can still be drawn later.
 *
 * The administrative layout is a server component that awaits the session, so
 * with no connection there is nobody to render as and nothing renders at all.
 * This runs on every successful load — when there is, by definition, a
 * connection and an answer — and leaves the answer behind for the times there
 * is not.
 *
 * Renders nothing.
 */
export function SessionSnapshotWriter({
  user,
  ministryName,
  compact,
}: {
  user: CurrentUser;
  ministryName: string | null;
  compact: boolean;
}) {
  useEffect(() => {
    void saveSessionSnapshot({ user, ministryName, compact });
    // Keyed on the fields rather than the object: `user` is a fresh object on
    // every server render, so depending on it would rewrite this on every
    // navigation for no gain.
  }, [user, user.id, user.name, user.email, ministryName, compact]);

  return null;
}
