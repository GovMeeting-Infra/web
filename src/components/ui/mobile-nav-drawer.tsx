'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import { SidebarNav } from './sidebar-nav';

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The sidebar, as a slide-over panel, for viewports too narrow to give 288px to
 * navigation. Below lg the sidebar itself is display:none and this stands in
 * for it.
 *
 * A separate component rather than the same <aside> repositioned, for three
 * reasons: a dialog needs role/aria-modal that a sidebar must not have, and
 * varying those by viewport would mean deciding the layout in JS at render time
 * — which is a hydration mismatch waiting to happen; the sidebar's 700ms
 * width transition and collapsed rail are wrong for a drawer; and an off-canvas
 * panel stays tabbable unless it is also removed. Mounting only while open
 * settles all three, and leaves the desktop tree untouched.
 */
export function MobileNavDrawer({
  open,
  onClose,
  ministryName,
}: {
  open: boolean;
  onClose: () => void;
  ministryName?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  // Read through a ref, so the effect below can depend on `open` alone. The
  // caller passes a fresh arrow every render; with onClose in the dep array,
  // any re-render of the layout while the drawer was open re-ran the whole
  // effect — snatching focus back to the close button mid-interaction, and
  // overwriting restoreTo with whatever happened to be focused, which is
  // usually a drawer node that is about to unmount.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      // getClientRects() filters out anything display:none — the nav hides
      // group headings and labels at some sizes, and tabbing to them would
      // strand focus somewhere invisible.
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.getClientRects().length > 0);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Crossing to lg hides this panel in CSS while React still thinks it is
    // open, which would leave the focus trap herding focus into something
    // nobody can see. Matches the lg breakpoint the sidebar returns at.
    const desktop = window.matchMedia('(min-width: 64rem)');
    const onCrossBreakpoint = (event: MediaQueryListEvent) => {
      if (event.matches) closeRef.current();
    };

    document.addEventListener('keydown', onKey);
    desktop.addEventListener('change', onCrossBreakpoint);

    return () => {
      document.removeEventListener('keydown', onKey);
      desktop.removeEventListener('change', onCrossBreakpoint);
      const previous = restoreTo.current;
      if (previous && document.body.contains(previous)) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Not a <button>: Escape and the close control are the keyboard routes
          out, so this needs no place in the tab order. touch-none stops the
          page panning under it — the document itself never scrolls (body is
          height-capped) and <main> is not an ancestor of this, so there is no
          scroll chaining left to block. */}
      <div
        onClick={onClose}
        className="animate-fade-in absolute inset-0 touch-none bg-[#0b1f3a]/50"
      />

      <div
        ref={panelRef}
        id="mobile-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Main navigation"
        className="animate-drawer-in absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col overflow-hidden overscroll-contain border-r border-sidebar-border bg-[linear-gradient(180deg,#f7fbff_0%,#f1f7fe_100%)] shadow-[0_24px_60px_rgba(0,53,128,0.28)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-sidebar-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/coat_of_arms.jpeg"
              alt="Sierra Leone coat of arms"
              width={44}
              height={44}
              className="h-10 w-10 flex-shrink-0 object-contain"
            />
            {/* The ministry name lives here on mobile: the topbar badge that
                carries it on desktop is hidden at this width. */}
            <div className="min-w-0 space-y-1">
              <span className="block text-[17px] font-semibold leading-none tracking-[-0.02em] text-sidebar-foreground">
                GovMeeting
              </span>
              <span className="block truncate text-[10px] font-medium uppercase tracking-[0.16em] text-sidebar-primary/80">
                {ministryName ?? 'Government of Sierra Leone'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="-mr-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sidebar-foreground transition-colors hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <SidebarNav collapsed={false} onNavigate={onClose} tourAnchors={false} />
      </div>
    </div>
  );
}
