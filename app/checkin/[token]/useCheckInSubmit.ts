'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, ApiError, isOffline, messageFor } from '@/lib/api/client';
import { acquireLocation, GeolocationError } from '@/lib/hooks/useGeolocation';
import { useGeolocationPermission } from '@/lib/hooks/useGeolocationPermission';
import type { HelpReason } from '@/lib/checkin/locationHelp';
import type { CheckInResult } from '@/lib/types/events';

export type SubmitPhase = 'idle' | 'locating' | 'submitting';
export type LocateStage = 'precise' | 'coarse' | null;

/** Server reasons, in the client's vocabulary. */
const API_REASONS: Record<string, HelpReason> = {
  LOCATION_REQUIRED: 'DENIED',
  ACCURACY_TOO_LOW: 'ACCURACY',
  OUTSIDE_AREA: 'OUTSIDE',
};

/**
 * Shared submit path for the staff and guest forms.
 *
 * Location is always requested, but what a refusal costs depends on the
 * meeting. Where a check-in area gates entry the fix decides whether someone
 * may check in, so a refusal stops the submission — the server would reject it
 * anyway, and failing here gives a clearer reason. Where none does, it is
 * recorded and nothing more, so a refusal must not stand between someone and
 * their attendance being counted.
 *
 * A failure is kept as a reason rather than only a sentence, because "blocked
 * permission" and "standing in the wrong place" need completely different
 * advice, and one of them is not fixable by tapping the button again.
 */
export function useCheckInSubmit(geofenceRequired: boolean) {
  const [phase, setPhase] = useState<SubmitPhase>('idle');
  const [stage, setStage] = useState<LocateStage>(null);
  const [error, setError] = useState<string | null>(null);
  const [helpReason, setHelpReason] = useState<HelpReason | null>(null);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [result, setResult] = useState<CheckInResult | null>(null);

  const permission = useGeolocationPermission();

  // What to send again if they fix their settings, so nobody has to redraw a
  // signature they already gave.
  const lastAttempt = useRef<{
    path: string;
    payload: Record<string, unknown>;
  } | null>(null);

  const submit = useCallback(
    async (path: string, payload: Record<string, unknown>) => {
      lastAttempt.current = { path, payload };
      setError(null);
      setHelpReason(null);
      setAlreadyCheckedIn(false);

      let coords: Record<string, number> = {};

      setPhase('locating');
      try {
        const fix = await acquireLocation({ onStage: setStage });
        coords = {
          lat: fix.latitude,
          lng: fix.longitude,
          gpsAccuracy: fix.accuracy,
        };
      } catch (err) {
        if (geofenceRequired) {
          setPhase('idle');
          setStage(null);
          setHelpReason(
            err instanceof GeolocationError
              ? (err.reason as HelpReason)
              : 'UNAVAILABLE',
          );
          setError(
            err instanceof GeolocationError
              ? `${err.message} This meeting can only be checked into at the venue.`
              : 'Your location is required to check in to this meeting.',
          );
          return;
        }
        // No gate: carry on without coordinates rather than refuse a check-in
        // over a reading nothing was going to be measured against.
      } finally {
        setStage(null);
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
          if (err instanceof ApiError && err.code && API_REASONS[err.code]) {
            setHelpReason(API_REASONS[err.code]);
          }
          // The form stays mounted through all of these, so what has been
          // typed and drawn is still on screen. Each message now says so and
          // names the way out — an expired token in particular used to end the
          // attempt with a bare statement, next to a signature the person had
          // just given and no instruction about what to do with it.
          const expired =
            err instanceof ApiError &&
            (err.status === 410 ||
              /expire/i.test(err.message) ||
              err.code === 'TOKEN_EXPIRED');

          if (expired) {
            setError(
              'That code expired while you were filling this in. Ask the organiser to show the code again and scan it — what you have typed and signed is still here.',
            );
          } else if (isOffline(err)) {
            setError(
              'Your connection dropped before we could record you. Nothing has been lost — tap Check in again when you have a signal.',
            );
          } else {
            setError(
              messageFor(
                err,
                'We could not complete your check-in. Tap Check in to try again, or ask the organiser to record you at the desk.',
              ),
            );
          }
        }
      } finally {
        setPhase('idle');
      }
    },
    [geofenceRequired],
  );

  const retry = useCallback(() => {
    const attempt = lastAttempt.current;
    if (attempt) void submit(attempt.path, attempt.payload);
  }, [submit]);

  // They went to settings, allowed it, and came back. Nothing more should be
  // asked of them. Only fires where the browser reports permission changes at
  // all, which rules out every browser on an iPhone.
  useEffect(() => {
    if (permission === 'granted' && helpReason === 'DENIED') {
      retry();
    }
  }, [permission, helpReason, retry]);

  return {
    phase,
    stage,
    error,
    helpReason,
    permission,
    alreadyCheckedIn,
    result,
    submit,
    retry,
    /** For the voluntary pre-flight probe, which fails outside a submission. */
    reportLocationProblem: setHelpReason,
  };
}

export function submitLabel(
  phase: SubmitPhase,
  geofenceRequired: boolean,
  stage: LocateStage = null,
): string {
  // The second attempt can take fifteen seconds on its own, and a button that
  // has said the same thing for twenty looks broken.
  if (phase === 'locating') {
    return stage === 'coarse' ? 'Still finding you…' : 'Getting location…';
  }
  if (phase === 'submitting') return 'Checking in…';
  return geofenceRequired ? 'Check in at venue' : 'Check in';
}
