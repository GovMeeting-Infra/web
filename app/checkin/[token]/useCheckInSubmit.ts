'use client';

import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api/client';
import { requestLocation, GeolocationError } from '@/lib/hooks/useGeolocation';
import type { CheckInResult } from '@/lib/types/events';

export type SubmitPhase = 'idle' | 'locating' | 'submitting';

/**
 * Shared submit path for the staff and guest forms.
 *
 * Location is always requested, but what a refusal costs depends on the
 * meeting. Where a check-in area exists the fix gates entry, so a refusal stops
 * the submission — the server would reject it anyway, and failing here gives a
 * clearer reason. Where none exists it is recorded and nothing more, so a
 * refusal must not stand between someone and their attendance being counted.
 *
 * It previously asked only when a fence existed, which meant the check-ins
 * nothing verified were also the ones with no location on record.
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

    setPhase('locating');
    try {
      const fix = await requestLocation();
      coords = {
        lat: fix.latitude,
        lng: fix.longitude,
        gpsAccuracy: fix.accuracy,
      };
    } catch (err) {
      if (geofenceRequired) {
        setPhase('idle');
        // err.message already names the specific problem and its remedy —
        // blocked permission, timed out, or services switched off.
        setError(
          err instanceof GeolocationError
            ? `${err.message} This meeting can only be checked into at the venue.`
            : 'Your location is required to check in to this meeting.',
        );
        return;
      }
      // No fence: carry on without coordinates rather than refuse a check-in
      // over a reading nothing was going to be measured against.
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
