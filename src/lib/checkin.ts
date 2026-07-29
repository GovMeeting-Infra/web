import type { CheckInContext } from './types/events';
import { API_BASE } from './api-base';

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
