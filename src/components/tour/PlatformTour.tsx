'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';
import type { SystemRole } from '@/lib/roles';
import { stepsForRole, TOUR_VERSION, type TourStep } from '@/lib/tour/steps';

/**
 * Where the tour is up to, kept in sessionStorage.
 *
 * The tour walks real pages, so each hop is a full client-side navigation and
 * this component unmounts and remounts. React state cannot survive that;
 * sessionStorage can, and it dies with the tab, which is the right lifetime for
 * something nobody wants resumed a week later.
 */
const STATE_KEY = 'govmeeting.tour';

interface TourState {
  index: number;
}

function readState(): TourState | null {
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as TourState) : null;
  } catch {
    return null;
  }
}

function writeState(state: TourState | null) {
  try {
    if (state) sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
    else sessionStorage.removeItem(STATE_KEY);
  } catch {
    // A browser refusing storage should cost the tour, not the page.
  }
}

/** Waits for a selector to appear, giving up rather than hanging forever. */
function waitForElement(selector: string, timeoutMs = 4000): Promise<boolean> {
  if (document.querySelector(selector)) return Promise.resolve(true);

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(true);
      }
    });

    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(false);
    }, timeoutMs);

    observer.observe(document.body, { childList: true, subtree: true });
  });
}

export function PlatformTour({
  role,
  firstName,
  completedVersion,
}: {
  role: SystemRole;
  firstName: string;
  completedVersion: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // One run per mount. Without this, a re-render mid-tour starts a second
  // driver over the first and the page ends up with two overlays.
  const running = useRef(false);

  useEffect(() => {
    if (running.current) return;

    const steps = stepsForRole(role, firstName);
    const saved = readState();

    // Start only on the dashboard, which is where signing in lands. Resuming
    // can happen anywhere, because that is the tour navigating.
    const isFirstRun =
      !saved &&
      completedVersion !== TOUR_VERSION &&
      pathname === '/administrative/dashboard';

    if (!saved && !isFirstRun) return;

    const startIndex = saved?.index ?? 0;
    if (startIndex >= steps.length) {
      writeState(null);
      return;
    }

    // Only run here if this page is the one the current step belongs to.
    // Otherwise the navigation is still in flight and the next mount handles it.
    if (steps[startIndex].route !== pathname) return;

    running.current = true;
    let cancelled = false;

    const finish = async () => {
      writeState(null);
      try {
        await apiFetch('/api/v1/me/preferences', {
          method: 'PATCH',
          body: JSON.stringify({ tourCompletedVersion: TOUR_VERSION }),
        });
      } catch {
        // Not worth interrupting anyone over. Worst case the tour offers
        // itself again next time.
      }
    };

    void (async () => {
      const { driver } = await import('driver.js');
      await import('driver.js/dist/driver.css');
      if (cancelled) return;

      // The run of steps that live on this page. The step after it, if any,
      // is on another page and is reached by navigating.
      const group: TourStep[] = [];
      for (let i = startIndex; i < steps.length; i++) {
        if (steps[i].route !== pathname) break;
        group.push(steps[i]);
      }

      // Drop steps whose target never arrives — an empty list on a fresh
      // deployment has no rows to point at.
      const present = await Promise.all(
        group.map(async (s) => !s.element || (await waitForElement(s.element))),
      );
      const usable = group.filter((_, i) => present[i]);
      if (cancelled) return;

      const nextIndex = startIndex + group.length;
      const hasMore = nextIndex < steps.length;

      if (usable.length === 0) {
        // Nothing to show here; move on rather than stall.
        if (hasMore) {
          writeState({ index: nextIndex });
          router.push(steps[nextIndex].route);
        } else {
          void finish();
        }
        return;
      }

      const instance = driver({
        showProgress: true,
        allowClose: true,
        overlayColor: '#0b1f3a',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: hasMore ? 'Next' : 'Done',
        steps: usable.map((s) => ({
          element: s.element,
          popover: { title: s.title, description: s.description },
        })),
        // Fires on the close button, Escape, and after the final step.
        onDestroyStarted: () => {
          const onLastStep = !instance.hasNextStep();

          if (onLastStep && hasMore) {
            // Carry on to the next page rather than ending here.
            writeState({ index: nextIndex });
            instance.destroy();
            router.push(steps[nextIndex].route);
            return;
          }

          // Finished the whole thing, or dismissed it. Either way, do not ask
          // again — someone who closed it does not want it back tomorrow.
          instance.destroy();
          void finish();
        },
      });

      instance.drive();
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, role, firstName, completedVersion, router]);

  return null;
}
