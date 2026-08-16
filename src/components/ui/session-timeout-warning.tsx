'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import { Modal } from './modal';

/** How long before the deadline to speak up. */
const WARN_BEFORE_MS = 2 * 60 * 1000;
/** Activity that counts as "still here". */
const ACTIVITY = ['pointerdown', 'keydown', 'scroll', 'focus'] as const;

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Warns before an inactivity sign-out, and offers a way to stay.
 *
 * Nothing warned before this existed. The session simply stopped being valid,
 * the shell carried on rendering as though signed in, and the first sign was a
 * failed save — with the guard's own "No user in request" in a red box. WCAG
 * 2.2.1 requires a time limit to be announced and extendable; this is the
 * announcement and the extension.
 *
 * The server refreshes the session on any authenticated request (throttled to
 * once a minute), so ordinary work already keeps someone signed in. This timer
 * mirrors that clock locally to know when to speak, and "Stay signed in" makes
 * the request that pushes the real deadline out.
 */
export function SessionTimeoutWarning() {
  const [timeoutMs, setTimeoutMs] = useState<number | null>(null);
  const [showing, setShowing] = useState(false);
  const [remaining, setRemaining] = useState(WARN_BEFORE_MS);
  // Seeded in the effect below rather than at render: Date.now() during render
  // is impure and gives the server and the client different starting clocks.
  const lastActivity = useRef(0);

  // Ask once what the window actually is. It is a platform setting, so it
  // cannot be hardcoded — the product documentation has been wrong about this
  // number twice already.
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ sessionTimeoutSeconds?: number }>('/api/v1/auth/session')
      .then((res) => {
        if (!cancelled && res?.sessionTimeoutSeconds) {
          setTimeoutMs(res.sessionTimeoutSeconds * 1000);
        }
      })
      .catch(() => {
        // No warning is better than a wrong one; the app behaves as before.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const markActive = useCallback(() => {
    lastActivity.current = Date.now();
    setShowing(false);
  }, []);

  useEffect(() => {
    if (!timeoutMs) return;
    // The clock starts when we learn how long the window is, not at render.
    if (lastActivity.current === 0) lastActivity.current = Date.now();

    // While the dialog is up, pointer and key events are the user answering it
    // — counting those as activity would dismiss the warning they are reading.
    const onActivity = () => {
      if (!showing) markActive();
    };
    ACTIVITY.forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true }),
    );

    const interval = setInterval(() => {
      const idleFor = Date.now() - lastActivity.current;
      const left = timeoutMs - idleFor;
      setRemaining(left);
      if (left <= WARN_BEFORE_MS) setShowing(true);
      if (left <= 0) {
        // The cookie is already dead server-side; a full load lands on the
        // login page with a reason rather than leaving a shell that lies.
        window.location.href = `/administrative/login?reason=expired&callbackUrl=${encodeURIComponent(
          window.location.pathname,
        )}`;
      }
    }, 1000);

    return () => {
      ACTIVITY.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(interval);
    };
  }, [timeoutMs, showing, markActive]);

  const staySignedIn = async () => {
    try {
      // Any authenticated request pushes the server's expiry out; this is the
      // cheapest one.
      await apiFetch('/api/v1/auth/session');
    } catch {
      // Ignored: if it failed, the next tick sends them to sign in anyway.
    }
    markActive();
  };

  if (!showing) return null;

  return (
    <Modal
      open
      onClose={staySignedIn}
      title="You are about to be signed out"
      description={`For security, you are signed out after a period without activity. You have ${formatRemaining(remaining)} left.`}
      className="max-w-md"
      footer={
        <button
          type="button"
          onClick={staySignedIn}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Stay signed in
        </button>
      }
    >
      <p className="text-sm text-muted-foreground">
        Anything you have typed and not saved is still on the page. Choosing
        Stay signed in keeps it.
      </p>
    </Modal>
  );
}
