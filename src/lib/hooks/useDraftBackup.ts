'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';

export interface DraftBackup {
  decisions: string[];
  nextSteps: string[];
  savedAt: string;
}

const KEY = (eventId: string) => `minutes-draft:${eventId}`;

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
 */
export function useDraftBackup(
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
      try {
        return window.localStorage.getItem(KEY(eventId));
      } catch {
        return null;
      }
    },
    () => null,
  );

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
    // Clean means the server has it. Keeping a copy past that point is how a
    // stale draft comes back to haunt someone weeks later.
    if (!isDirty) {
      try {
        window.localStorage.removeItem(KEY(eventId));
      } catch {
        // Private mode, quota, or storage disabled. Nothing to recover from.
      }
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          KEY(eventId),
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
  }, [eventId, decisions, nextSteps, isDirty]);

  return found;
}

export function discardDraftBackup(eventId: string) {
  try {
    window.localStorage.removeItem(KEY(eventId));
  } catch {
    // Nothing to do.
  }
}
