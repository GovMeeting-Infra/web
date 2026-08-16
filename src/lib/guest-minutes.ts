import { API_BASE } from './api-base';
import type { ActionItemStatus } from './types/events';

export interface GuestActionItem {
  id: string;
  title: string;
  description: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  dueDate: string;
  status: ActionItemStatus;
  progressNotes: string | null;
  progressLink: string | null;
  /** Whether this item belongs to the address the link was issued to. */
  isMine: boolean;
}

export interface GuestMinutes {
  viewerEmail: string;
  event: {
    title: string;
    startAt: string;
    endAt: string;
    venueName: string | null;
    ministryName: string | null;
  };
  minutes: {
    /** What the meeting settled, one line each, in order. */
    decisions: string[];
    /** What happens next, with nobody assigned. */
    nextSteps: string[];
    publishedAt: string | null;
  };
  actionItems: GuestActionItem[];
}

/**
 * The published record behind a guest link.
 *
 * Returns null rather than throwing, so a stale or unknown token renders an
 * explanation instead of a 500 — the server already answers every failure
 * identically, and this keeps that indistinguishable at the page level too.
 *
 * cache: 'no-store' is deliberate. The token is in the URL, so a revalidated
 * cache entry would be keyed on a credential and could outlive the access it
 * represents.
 */
export async function getGuestMinutes(
  token: string,
): Promise<GuestMinutes | null> {
  try {
    const response = await fetch(
      `${API_BASE}/api/v1/guest/minutes/${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    );

    if (!response.ok) return null;
    return (await response.json()) as GuestMinutes;
  } catch {
    return null;
  }
}
