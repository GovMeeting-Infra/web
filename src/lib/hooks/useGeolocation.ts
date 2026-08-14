export interface GeolocationFix {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/** Which way the request failed, so callers can offer the right way out. */
export type GeolocationFailure =
  | 'UNSUPPORTED'
  | 'DENIED'
  | 'TIMEOUT'
  | 'UNAVAILABLE';

/**
 * Carries the reason as well as the message.
 *
 * The reason used to be discarded, leaving only prose — so nothing could tell
 * a permission the user had blocked (which another tap will never fix; it
 * needs browser settings) from a fix that simply timed out (which retrying
 * often does fix).
 */
export class GeolocationError extends Error {
  reason: GeolocationFailure;

  constructor(reason: GeolocationFailure, message: string) {
    super(message);
    this.name = 'GeolocationError';
    this.reason = reason;
  }
}

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  // Never accept a cached fix. The browser will happily hand back a position
  // recorded minutes ago on another site, which is worthless for deciding
  // whether someone is standing in the room right now.
  maximumAge: 0,
};

/**
 * Ask the device for its location, once, on demand.
 *
 * Deliberately called at submit time rather than from an effect on mount: the
 * permission prompt should appear when the user acts, and a fix taken at mount
 * may be stale by the time they finish signing. It also means pages without a
 * geofence never request a permission they will not use.
 */
export function requestLocation(
  options: PositionOptions = {},
): Promise<GeolocationFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(
        new GeolocationError(
          'UNSUPPORTED',
          'This browser cannot share your location.',
        ),
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) =>
        reject(
          error.code === error.PERMISSION_DENIED
            ? new GeolocationError(
                'DENIED',
                'Location access is blocked. Allow location for this site in your browser settings, then try again.',
              )
            : error.code === error.TIMEOUT
              ? new GeolocationError(
                  'TIMEOUT',
                  'Timed out finding your location. Move somewhere with a clearer view of the sky and try again.',
                )
              : new GeolocationError(
                  'UNAVAILABLE',
                  'Your location could not be determined. Check that location services are switched on.',
                ),
        ),
      { ...DEFAULT_OPTIONS, ...options },
    );
  });
}
