import type { CheckInContext } from './types/events';

/**
 * Server components must call the API directly rather than through the
 * /api/:path* rewrite in next.config.ts — that rewrite exists for the browser,
 * and a server-side fetch to a relative path has no origin to resolve against.
 * Mirrors what src/lib/session.ts already does.
 */
const API_BASE = process.env.INTERNAL_API_URL || 'http://localhost:4000';

/**
 * What a scanned check-in token can currently do.
 *
 * Never throws: a token page that 500s tells the attendee nothing useful, so a
 * failure is reported as an unrecognised code.
 */
export async function getCheckInContext(
  token: string,
): Promise<CheckInContext> {
  try {
    const response = await fetch(
      `${API_BASE}/api/v1/checkin/${encodeURIComponent(token)}/context`,
      { cache: 'no-store' },
    );

    if (!response.ok) {
      return { status: 'INVALID', event: null, geofenceRequired: false };
    }

    return (await response.json()) as CheckInContext;
  } catch {
    return { status: 'INVALID', event: null, geofenceRequired: false };
  }
}
