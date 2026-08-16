'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils/cn';

/** How long a finger must rest on a control before its tooltip appears. */
const LONG_PRESS_MS = 500;

/** Movement beyond this cancels a long press — it was a scroll, not a hold. */
const LONG_PRESS_SLOP_PX = 10;

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    // The first tooltip waits, so a mouse crossing a toolbar does not set off a
    // chain of them. Once one is open, moving to a neighbour is immediate —
    // which is what makes a dense row of icon buttons readable.
    <RadixTooltip.Provider delayDuration={200} skipDelayDuration={300}>
      {children}
    </RadixTooltip.Provider>
  );
}

/**
 * A hint attached to a control.
 *
 * Two rules this component exists to enforce, both easy to get wrong one call
 * site at a time:
 *
 * 1. **It is never the accessible name.** Radix puts the content on
 *    aria-describedby, so the trigger keeps whatever aria-label it already
 *    has. A control with no label needs one adding — a tooltip is not a
 *    substitute, and it does not exist for a screen reader at all.
 *
 * 2. **Content may never contain a heading.** PlatformTour resolves seven of
 *    its steps with a bare document-wide `h1` query and takes the first match,
 *    so an `h1` inside this portal would make the tour highlight a tooltip
 *    instead of the page.
 *
 * It portals, which is not cosmetic: the tables wrap themselves in
 * `overflow-hidden` with `overflow-x-auto` inside, and a tooltip rendered in a
 * table cell would be clipped by its own container.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  /** Skip entirely — for text that turned out not to be truncated after all. */
  disabled = false,
}: {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef<{ x: number; y: number } | null>(null);
  /** Set when a hold fired, so the click it would produce can be swallowed. */
  const firedLongPress = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    startedAt.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  if (disabled || !content) return children;

  /**
   * Checked when opening rather than while rendering: sessionStorage does not
   * exist on the server, and branching on it during render would hydrate to
   * different markup than was sent.
   *
   * driver.js already puts an overlay and a popover on screen during a tour; a
   * second floating layer over the top is just clutter.
   */
  const handleOpenChange = (next: boolean) => {
    if (next && window.sessionStorage?.getItem('govmeeting.tour')) return;
    setOpen(next);
  };

  /**
   * Touch has no hover, so a hold stands in for one. Radix deliberately never
   * opens on touch, which is why `open` is driven here rather than left to it.
   */
  const touchHandlers = {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      startedAt.current = { x: t.clientX, y: t.clientY };
      firedLongPress.current = false;
      timer.current = setTimeout(() => {
        firedLongPress.current = true;
        handleOpenChange(true);
      }, LONG_PRESS_MS);
    },
    onTouchMove: (e: React.TouchEvent) => {
      const start = startedAt.current;
      if (!start) return;
      const t = e.touches[0];
      if (
        Math.abs(t.clientX - start.x) > LONG_PRESS_SLOP_PX ||
        Math.abs(t.clientY - start.y) > LONG_PRESS_SLOP_PX
      ) {
        cancel();
      }
    },
    onTouchEnd: () => {
      cancel();
      // Left open deliberately: the next tap anywhere dismisses it, which is
      // how a reader gets time to actually read the thing.
    },
    onTouchCancel: cancel,
    onClickCapture: (e: React.MouseEvent) => {
      // The click that follows a hold must not reach the button. Without this,
      // holding a Delete control to find out what it does would delete it.
      if (firedLongPress.current) {
        e.preventDefault();
        e.stopPropagation();
        firedLongPress.current = false;
        setOpen(false);
      }
    },
  };

  return (
    <RadixTooltip.Root
      open={open}
      onOpenChange={handleOpenChange}
      disableHoverableContent
    >
      <RadixTooltip.Trigger asChild {...touchHandlers}>
        {children}
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          // Above the z-50 the modals and drawers use, so a tooltip on a
          // control inside a dialog is not hidden behind it.
          className={cn(
            'z-[60] max-w-[16rem] rounded-lg bg-foreground px-2.5 py-1.5',
            'text-xs leading-relaxed text-white shadow-lg',
            'animate-fade-in',
          )}
        >
          {content}
          <RadixTooltip.Arrow className="fill-foreground" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
