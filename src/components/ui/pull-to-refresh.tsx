'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { RotateCw } from 'lucide-react';

/** How far the finger has to travel, after damping, before letting go reloads. */
const THRESHOLD = 70;
const MAX_PULL = 110;
/** Finger distance to indicator distance — a 1:1 pull feels loose. */
const DAMPING = 0.5;

/**
 * Pull down at the top of a page to reload it.
 *
 * The browser's own gesture never fires here: the page scrolls inside <main>,
 * not the document, and both iOS and Android only offer theirs when the
 * document itself is overscrolled. An installed app has no reload button
 * either, so without this there was no way to refresh from a phone at all.
 *
 * `overscroll-behavior-y: contain` on the scroller (see admin-layout) stops the
 * overscroll chaining to the document, so Android Chrome cannot run its own
 * gesture on top of this one and reload twice.
 *
 * A full reload rather than router.refresh(): most pages fetch on the client
 * after mounting, and a server refresh would leave all of that as it was.
 *
 * Styles are written straight to the element from refs — a touchmove arrives
 * every frame, and a React render per frame is what makes these feel sticky.
 */
export function PullToRefresh({
  scrollRef,
}: {
  scrollRef: RefObject<HTMLElement | null>;
}) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const scroller = scrollRef.current;
    const indicator = indicatorRef.current;
    const icon = iconRef.current;
    if (!scroller || !indicator || !icon) return;
    // Mouse and trackpad have reload buttons and keyboard shortcuts.
    if (!window.matchMedia('(pointer: coarse)').matches) return;

    let startX = 0;
    let startY = 0;
    let pull = 0;
    let tracking = false;
    let pulling = false;
    let refreshing = false;

    const paint = (distance: number, animate: boolean) => {
      indicator.style.transition = animate ? 'transform 200ms ease, opacity 200ms ease' : 'none';
      indicator.style.transform = `translate(-50%, ${distance - 48}px)`;
      indicator.style.opacity = String(Math.min(distance / THRESHOLD, 1));
      icon.style.transform = `rotate(${distance * 3}deg)`;
      indicator.dataset.ready = distance >= THRESHOLD ? 'true' : 'false';
    };

    const reset = () => {
      tracking = false;
      pulling = false;
      pull = 0;
      paint(0, true);
    };

    /**
     * Only when nothing between the finger and <main> would scroll up instead —
     * a scrolled list inside the page, or an open dialog, owns that gesture.
     */
    const canStart = (target: EventTarget | null) => {
      if (scroller.scrollTop > 0) return false;
      let el = target instanceof Element ? target : null;
      while (el && el !== scroller) {
        if (el.closest('[role="dialog"], [aria-modal="true"]')) return false;
        if (el.scrollTop > 0) return false;
        el = el.parentElement;
      }
      return true;
    };

    const onStart = (e: TouchEvent) => {
      if (refreshing || e.touches.length !== 1 || !canStart(e.target)) return;
      tracking = true;
      pulling = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (!pulling) {
        // Decide once, on the first real movement: a sideways swipe or an
        // upward scroll is not a pull and must be left alone.
        if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || scroller.scrollTop > 0) {
          tracking = false;
          return;
        }
        pulling = true;
      }

      // Pulled back up past where it started: hand scrolling back.
      if (dy <= 0) {
        reset();
        return;
      }
      // Otherwise iOS rubber-bands the page under the indicator.
      e.preventDefault();
      pull = Math.min(dy * DAMPING, MAX_PULL);
      paint(pull, false);
    };

    const onEnd = () => {
      if (!tracking) return;
      if (pulling && pull >= THRESHOLD) {
        refreshing = true;
        tracking = false;
        paint(THRESHOLD, true);
        indicator.dataset.refreshing = 'true';
        window.location.reload();
        return;
      }
      reset();
    };

    scroller.addEventListener('touchstart', onStart, { passive: true });
    // Not passive: onMove has to be able to cancel the native overscroll.
    scroller.addEventListener('touchmove', onMove, { passive: false });
    scroller.addEventListener('touchend', onEnd);
    scroller.addEventListener('touchcancel', reset);
    return () => {
      scroller.removeEventListener('touchstart', onStart);
      scroller.removeEventListener('touchmove', onMove);
      scroller.removeEventListener('touchend', onEnd);
      scroller.removeEventListener('touchcancel', reset);
    };
  }, [scrollRef]);

  return (
    <div
      ref={indicatorRef}
      aria-hidden="true"
      data-ready="false"
      // Parked above the content column, which clips it, until pulled.
      className="group pointer-events-none absolute left-1/2 top-0 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-md data-[ready=true]:text-primary"
      style={{ transform: 'translate(-50%, -48px)' }}
    >
      <RotateCw
        ref={iconRef}
        className="h-5 w-5 group-data-[refreshing=true]:animate-spin motion-reduce:group-data-[refreshing=true]:animate-none"
      />
    </div>
  );
}
