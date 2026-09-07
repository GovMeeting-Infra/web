'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';

export interface DraftBackup {
  decisions: string[];
  nextSteps: string[];
  savedAt: string;
}

const PREFIX = 'minutes-draft:';

/**
 * Scoped to the person, not just the meeting.
 *
 * The key used to be `minutes-draft:${eventId}`, which is fine on a personal
 * laptop and wrong on the shared tablet a ministry keeps at the door: the next
 * person to open the same meeting's minutes was offered the previous person's
 * unsaved lines as a recovery banner, and could put them back under their own
 * name. Whose draft it is has to be part of the key.
 */
const KEY = (userId: string, eventId: string) =>
  `${PREFIX}${userId}:${eventId}`;

/** A key from before drafts were scoped to a user: exactly one segment after the prefix. */
function isLegacyKey(key: string): boolean {
  return key.startsWith(PREFIX) && key.slice(PREFIX.length).indexOf(':') === -1;
}

/**
 * Clear drafts written before the key carried a user id.
 *
 * Without this, every device already in use keeps its unscoped entries forever
 * — they are no longer read, but they are still someone's unpublished minutes
 * sitting in storage on a machine other people use.
 */
function purgeLegacyDrafts(): void {
  try {
    const stale: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && isLegacyKey(key)) stale.push(key);
    }
    stale.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Private mode, quota, or storage disabled. Nothing to clean up.
  }
}

/**
 * No subscription. Nothing outside this hook writes the key, and the one thing
 * that does write it re-renders on its own — so there is no event to listen for
 * and no cleanup to do.
 */
const subscribeToNothing = () => () => {};

/**
 * Keeps a copy of unsaved minutes in the browser.
 *
 * Minutes are written on a phone, in a room, often on a connection that drops
 * — and until now the only copy of a half-written record lived in React state.
 * A failed save showed the raw fetch error and changed nothing else; an iOS tab
 * discard while someone stepped out lost the meeting outright. There is no
 * server-side draft to fall back on, because a draft that autosaves would put
 * half-formed lines in front of everyone who can already read drafts.
 *
 * So: local only, debounced, and cleared the moment the server has the text.
 * Returns whatever was left behind by a previous session, for the page to offer
 * back rather than restore silently — restoring on its own would be another
 * version of the bug this replaced, overwriting the record without being asked.
 *
 * A null `userId` disables the backup entirely. That should not happen inside
 * the administrative shell, and if it ever does, writing an unattributable
 * draft to a shared device is worse than not having a safety net.
 */
export function useDraftBackup(
  userId: string | null,
  eventId: string,
  decisions: string[],
  nextSteps: string[],
  isDirty: boolean,
): DraftBackup | null {
  /**
   * localStorage read as an external store rather than copied into state by an
   * effect.
   *
   * The effect version was the same shape as the bug this hook exists to
   * prevent — setState during an effect — and it also had to guess at SSR. The
   * server snapshot is null, so the banner simply does not exist until the
   * client renders, and no hydration mismatch is possible.
   */
  const raw = useSyncExternalStore(
    subscribeToNothing,
    () => {
      if (!userId) return null;
      try {
        return window.localStorage.getItem(KEY(userId, eventId));
      } catch {
        return null;
      }
    },
    () => null,
  );

  useEffect(purgeLegacyDrafts, []);

  const found = useMemo<DraftBackup | null>(() => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as DraftBackup;
      return parsed.decisions?.length || parsed.nextSteps?.length
        ? parsed
        : null;
    } catch {
      // A corrupt entry is the same as no entry.
      return null;
    }
  }, [raw]);

  useEffect(() => {
    if (!userId) return;

    // Clean means the server has it. Keeping a copy past that point is how a
    // stale draft comes back to haunt someone weeks later.
    if (!isDirty) {
      try {
        window.localStorage.removeItem(KEY(userId, eventId));
      } catch {
        // Private mode, quota, or storage disabled. Nothing to recover from.
      }
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          KEY(userId, eventId),
          JSON.stringify({
            decisions,
            nextSteps,
            savedAt: new Date().toISOString(),
          }),
        );
      } catch {
        // Storage full or blocked. The editor still works; this is a safety
        // net, and a missing net must not break the thing it protects.
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [userId, eventId, decisions, nextSteps, isDirty]);

  return found;
}

export function discardDraftBackup(userId: string | null, eventId: string) {
  if (!userId) return;
  try {
    window.localStorage.removeItem(KEY(userId, eventId));
  } catch {
    // Nothing to do.
  }
}

/**
 * Drop every draft belonging to a user. Called on sign-out, so that leaving a
 * shared device does not leave unpublished minutes behind on it.
 */
export function purgeDraftBackups(userId: string): void {
  try {
    const prefix = `${PREFIX}${userId}:`;
    const mine: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(prefix)) mine.push(key);
    }
    mine.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Nothing to do.
  }
}
