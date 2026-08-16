'use client';

import { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils/cn';

const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * The dialog behaviour this product had already worked out twice, in one place.
 *
 * `search-dialog` and `mobile-nav-drawer` both trap focus correctly. Four other
 * overlays — edit user, erase personal data, edit ministry, deactivate ministry
 * — were plain fixed divs with no role, no focus move, no trap, no Escape and
 * no restore. Someone opening "Erase personal data" with a keyboard got no
 * announcement that anything had happened, focus still parked behind the
 * overlay, and had to tab blindly through the page underneath to reach the
 * confirmation field. That is a 4.1.2 and 2.4.3 failure on an irreversible
 * action in an audited system.
 *
 * The trap deliberately keeps the two hard-won details from those two working
 * implementations:
 *  - getClientRects() filters out display:none nodes, so focus is never sent
 *    somewhere invisible;
 *  - the !panel.contains(active) guard sits on BOTH Tab branches, because
 *    focus left outside the panel by a backdrop click otherwise escapes into
 *    the page behind an overlay that is not inert.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional supporting line, wired to aria-describedby. */
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /**
   * Where focus should land. Defaults to the first focusable node, which is
   * right for a form and wrong for a confirmation whose first control is the
   * destructive one.
   */
  initialFocus?: React.RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  // onClose is read through a ref so the effect below depends only on `open`.
  // Re-running it on every render would overwrite restoreTo with whatever is
  // focused inside the dialog, which is what we are trying to restore *from*.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    restoreTo.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    if (initialFocus?.current) initialFocus.current.focus();
    else panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

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

      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !panel.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    // The page behind must not scroll under a modal on touch.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      const previous = restoreTo.current;
      if (previous && document.body.contains(previous)) previous.focus();
    };
  }, [open, initialFocus]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-scrim/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn(
          'relative z-10 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[1.5rem] border border-border bg-card p-6 shadow-[0_24px_60px_rgba(0,53,128,0.24)]',
          className,
        )}
      >
        <h2 id={titleId} className="text-lg font-semibold text-primary">
          {title}
        </h2>
        {description && (
          <p id={descId} className="mt-1.5 text-sm text-muted-foreground">
            {description}
          </p>
        )}
        {children && <div className="mt-4">{children}</div>}
        {footer && (
          <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  );
}

/**
 * A modal whose whole job is "are you sure".
 *
 * Focus lands on Cancel, not on the destructive button: a confirmation that
 * opens with the dangerous control already focused turns a stray Enter into
 * the thing the dialog exists to prevent.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      initialFocus={cancelRef}
      className="max-w-md"
      footer={
        <>
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            className="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              'rounded-full px-4 py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60',
              destructive
                ? 'bg-alert-fg hover:bg-alert-fg/90'
                : 'bg-primary hover:bg-primary/90',
            )}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    />
  );
}
