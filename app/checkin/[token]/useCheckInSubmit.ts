'use client';

import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api/client';
import { requestLocation, GeolocationError } from '@/lib/hooks/useGeolocation';
import type { CheckInResult } from '@/lib/types/events';

export type SubmitPhase = 'idle' | 'locating' | 'submitting';

/**
 * Shared submit path for the staff and guest forms.
 *
 * Location is fetched here, at submit time, and only when the meeting actually
 * has a check-in area — asking for the permission otherwise trains people to
 * dismiss it.
 */
export function useCheckInSubmit(geofenceRequired: boolean) {
  const [phase, setPhase] = useState<SubmitPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);

  const submit = async (path: string, payload: Record<string, unknown>) => {
    setError(null);
    setAlreadyCheckedIn(false);

    let coords: Record<string, number> = {};

    if (geofenceRequired) {
      setPhase('locating');
      try {
        const fix = await requestLocation();
        coords = {
          lat: fix.latitude,
          lng: fix.longitude,
          gpsAccuracy: fix.accuracy,
        };
      } catch (err) {
        setPhase('idle');
        setError(
          err instanceof GeolocationError
            ? `${err.message} Location is required for this meeting. Enable GPS and try again.`
            : 'Location is required for this meeting. Enable GPS and try again.',
        );
        // Abort rather than submit: the server would reject it anyway, and
        // failing here gives a clearer reason.
        return;
      }
    }

    setPhase('submitting');
    try {
      const data = await apiFetch<CheckInResult>(path, {
        method: 'POST',
        body: JSON.stringify({ ...payload, ...coords }),
      });
      setResult(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Distinguishing 409 from 400 is why this uses apiFetch rather than a
        // raw fetch — "already checked in" is reassuring, not an error.
        setAlreadyCheckedIn(true);
        setError(err.message);
      } else {
        setError(
          err instanceof Error ? err.message : 'Could not complete check-in.',
        );
      }
    } finally {
      setPhase('idle');
    }
  };

  return { phase, error, alreadyCheckedIn, result, submit };
}

export function submitLabel(
  phase: SubmitPhase,
  geofenceRequired: boolean,
): string {
  if (phase === 'locating') return 'Getting location…';
  if (phase === 'submitting') return 'Checking in…';
  return geofenceRequired ? 'Check in at venue' : 'Check in';
}
