import type { PublicEventDetail } from './types/events';
import { API_BASE } from './api-base';

/**
 * A published public activity, or null.
 *
 * Null covers every failure — unknown id, a draft, an internal meeting, or the
 * API being unreachable. The endpoint deliberately returns the same 404 for all
 * of those, and callers show one "not available" panel rather than explaining
 * which it was.
 *
 * Revalidated rather than no-store: published activities do not change minute
 * to minute, and this page is meant to be crawled and shared.
 */
export async function getPublicEvent(
  id: string,
): Promise<PublicEventDetail | null> {
  try {
    const response = await fetch(
      `${API_BASE}/api/v1/public/events/${encodeURIComponent(id)}`,
      { next: { revalidate: 300 } },
    );

    if (!response.ok) return null;
    return (await response.json()) as PublicEventDetail;
  } catch {
    return null;
  }
}
