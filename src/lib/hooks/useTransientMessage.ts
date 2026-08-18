'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** How long an inline success or error banner stays on screen. */
export const MESSAGE_TIMEOUT_MS = 3000;

/**
 * State for an inline banner that clears itself.
 *
 * Every one of these messages used to be set and never unset, so a red
 * "Start time must be before end time" or a green "Invitation re-sent" sat on
 * the page until something else overwrote it or the page was reloaded. On a
 * long form that means an error about a field fixed two minutes ago is still
 * on screen, contradicting what the person is looking at.
 *
 * Drop-in for `useState<string | null>(null)`: same tuple, but setting a
 * message also schedules the clear, and setting a new one (or clearing it by
 * hand) cancels the pending timer rather than letting the old one blank the
 * new message early.
 *
 * Not for messages the page needs to keep: a failed load that leaves the view
 * empty, a save conflict, or a recovery panel someone has to act on. Those are
 * the page's state, not feedback about something that just happened.
 */
export function useTransientMessage<T = string>(
  timeoutMs: number = MESSAGE_TIMEOUT_MS,
) {
  const [message, setMessageState] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setMessage = useCallback(
    (next: T | null) => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      setMessageState(next);
      // '' is how a few call sites say "nothing to show"; it has no banner to
      // dismiss, so it gets no timer.
      if (next === null || next === undefined || next === ('' as unknown as T)) {
        return;
      }
      timer.current = setTimeout(() => {
        timer.current = null;
        setMessageState(null);
      }, timeoutMs);
    },
    [timeoutMs],
  );

  // A timer firing after the page has gone would set state on an unmounted
  // component — harmless in React 19, but it also keeps the closure alive.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return [message, setMessage] as const;
}
