'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Global search, for the widths where the topbar's search form is hidden.
 *
 * The icon it replaces was a plain link to /administrative/search. That page
 * reads its query from the URL and has no input of its own — the only input in
 * the app is the topbar form, which is hidden below md — so tapping search on a
 * phone landed on an empty results page with nowhere to type.
 *
 * A dialog rather than giving the results page its own field: the field is only
 * missing on the way in, and adding one to the page would put two search boxes
 * on screen at every width above md.
 */
export function SearchDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  // Read through a ref so the effect below depends on `open` alone — the caller
  // passes a fresh arrow every render, and re-running this would steal focus
  // back to the input mid-typing.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // The whole point of the dialog is somewhere to type, so go straight there
    // rather than to the first focusable element.
    inputRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.getClientRects().length > 0);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      // The !panel.contains(active) guard belongs on both branches. With it
      // only on the shift branch, focus sitting outside the panel — which is
      // what a click on the backdrop leaves behind — let a plain Tab escape
      // into the page behind the overlay, which is not inert.
      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    // Crossing to md brings the topbar's own search form back, which would
    // leave two search fields on screen with focus trapped in the hidden one.
    const desktop = window.matchMedia('(min-width: 48rem)');
    const onCrossBreakpoint = (event: MediaQueryListEvent) => {
      if (event.matches) closeRef.current();
    };

    document.addEventListener('keydown', onKey);
    desktop.addEventListener('change', onCrossBreakpoint);

    return () => {
      document.removeEventListener('keydown', onKey);
      desktop.removeEventListener('change', onCrossBreakpoint);
      // getClientRects() as well as contains(): when the dialog closes because
      // the viewport crossed to md, the button we came from is md:hidden by
      // then, and focus() on a display:none element is a silent no-op that
      // drops focus to <body>. Fall back to the search form that just became
      // visible, so a keyboard user stays where they were.
      const previous = restoreTo.current;
      if (previous && previous.getClientRects().length > 0) {
        previous.focus();
      } else {
        document
          .querySelector<HTMLElement>('header form[role="search"] input')
          ?.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const term = q.trim();
    if (term.length < 2) return;

    router.push(`/administrative/search?q=${encodeURIComponent(term)}`);
    // Leave the term in place: coming back to refine a search is the common
    // case, and an empty box would mean retyping it.
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Tint only. The scroller below covers the same area and would swallow
          any click aimed here, so dismissal lives there instead. */}
      <div className="animate-fade-in pointer-events-none absolute inset-0 bg-black/40" />

      {/* Anchored near the top rather than centred: the keyboard takes the
          bottom half of the screen the moment the input takes focus. This
          scrolls so the submit button stays reachable on a landscape phone,
          where the keyboard leaves about 175px of visible viewport and the
          button would otherwise sit under it with nothing to scroll.
          overscroll-contain keeps that scroll from chaining to the page. */}
      <div
        onClick={onClose}
        role="presentation"
        className="absolute inset-0 flex justify-center overflow-y-auto overscroll-contain p-4"
      >
        <div
          ref={panelRef}
          id="search-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          onClick={(e) => e.stopPropagation()}
          className="h-fit w-full max-w-lg rounded-[1.25rem] border border-border bg-card p-4 shadow-xl"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-primary">Search</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={submit} role="search" className="mt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                type="search"
                name="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search events, minutes, rooms…"
                aria-label="Search"
                className="w-full rounded-xl border border-border bg-muted/40 py-2.5 pl-9 pr-3 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <button
              type="submit"
              disabled={q.trim().length < 2}
              className="mt-3 w-full rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Search
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Type at least two characters.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
