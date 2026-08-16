'use client';

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { acquireLocation, GeolocationError } from '@/lib/hooks/useGeolocation';
import type { HelpReason } from '@/lib/checkin/locationHelp';

/**
 * Warns that the browser is about to ask for location, before it asks.
 *
 * The prompt fires on submit, and a permission dialog nobody was expecting
 * gets dismissed — which on a fenced meeting means the person cannot check in
 * at all. Saying so first is the difference between an informed "allow" and a
 * reflexive "block", and a blocked permission cannot be re-requested by
 * tapping again; it has to be undone in browser settings.
 *
 * Shown either way, because location is now recorded on every check-in. Only
 * the consequence differs: with a fence it decides whether you may check in,
 * without one it is simply part of the record.
 */
export function LocationNotice({
  required,
  onProblem,
}: {
  required: boolean;
  /** Report a failed probe, so the form can show the recovery steps. */
  onProblem?: (reason: HelpReason) => void;
}) {
  const [checking, setChecking] = useState(false);
  const [ok, setOk] = useState(false);

  /**
   * Find out now rather than after signing.
   *
   * The only pre-flight available on an iPhone: WebKit will not answer
   * navigator.permissions for geolocation, so the sole way to learn whether
   * this browser will share a position is to ask it for one. Being a tap, it
   * is also a legitimate moment for the prompt to appear.
   */
  const probe = async () => {
    setChecking(true);
    try {
      await acquireLocation();
      setOk(true);
    } catch (err) {
      onProblem?.(
        err instanceof GeolocationError
          ? (err.reason as HelpReason)
          : 'UNAVAILABLE',
      );
    } finally {
      setChecking(false);
    }
  };

  return (
    <div
      className={`mt-5 flex items-start gap-3 rounded-xl border p-3 text-left ${
        required
          ? 'border-stat-gold-border bg-stat-gold-bg text-stat-gold-fg'
          : 'border-border bg-muted/40 text-muted-foreground'
      }`}
    >
      <MapPin aria-hidden className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div className="text-xs leading-relaxed">
        <p>
          {required ? (
            <>
              <span className="font-semibold">
                You must be at the venue to check in.
              </span>{' '}
              When you submit, your browser will ask to share your location.
              Allow it — check-in cannot be completed without it.
            </>
          ) : (
            <>
              When you submit, your browser will ask to share your location. It
              is recorded with your check-in. You can still check in if you
              decline.
            </>
          )}
        </p>

        {required &&
          (ok ? (
            <p className="mt-2 font-medium">✓ Location is working.</p>
          ) : (
            <button
              type="button"
              onClick={probe}
              disabled={checking}
              className="mt-2 font-medium underline underline-offset-2 disabled:opacity-50"
            >
              {checking ? 'Checking…' : 'Check location access first'}
            </button>
          ))}
      </div>
    </div>
  );
}
