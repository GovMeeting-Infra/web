import type { PublicEventDetail } from './types/events';

/**
 * Server components must call the API directly rather than through the
 * /api/:path* rewrite in next.config.ts — that rewrite exists for the browser,
 * and a server-side fetch to a relative path has no origin to resolve against.
 * Same reasoning as src/lib/checkin.ts.
 */
const API_BASE = process.env.INTERNAL_API_URL || 'http://localhost:4000';

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
