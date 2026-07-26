export interface GeolocationFix {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export class GeolocationError extends Error {}

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
        new GeolocationError('Geolocation is not supported by your browser.'),
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
          new GeolocationError(
            error.code === error.PERMISSION_DENIED
              ? 'Location permission was denied.'
              : error.code === error.TIMEOUT
                ? 'Timed out waiting for your location.'
                : 'Could not determine your location.',
          ),
        ),
      { ...DEFAULT_OPTIONS, ...options },
    );
  });
}
