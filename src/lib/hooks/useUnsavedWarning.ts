'use client';

import { useEffect } from 'react';

/**
 * Warns before work in progress is thrown away.
 *
 * Nothing in this product guarded unsaved work: no beforeunload, no dirty
 * tracking, no autosave. The sharp case is minutes — a civil servant
 * transcribing a live meeting on a phone, where the "Back to Event" link sits
 * directly above the editor and a stray tap discards every decision recorded so
 * far. The create-event form is the same shape with twenty fields.
 *
 * beforeunload covers a reload, a tab close and a typed address. It cannot
 * cover an in-app <Link>, because the App Router gives no navigation blocker —
 * so the click handler below is the other half, and callers that render a Back
 * link should route it through `confirmLeave`.
 */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // Browsers ignore custom text now and show their own wording; assigning
      // returnValue is still what triggers the prompt at all.
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}

/**
 * Guard for an in-app link or button that would discard unsaved work.
 *
 * Returns true when it is safe to proceed. Deliberately a plain confirm: this
 * fires on a deliberate navigation away, where a modal would need its own focus
 * management inside a component that is already unmounting.
 */
export function confirmLeave(dirty: boolean): boolean {
  if (!dirty) return true;
  return window.confirm(
    'You have changes that have not been saved. Leave this page and lose them?',
  );
}
