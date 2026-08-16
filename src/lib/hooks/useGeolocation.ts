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
  | 'UNAVAILABLE'
  /** Served over plain http, where browsers disable location outright. */
  | 'INSECURE';

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

/** Good enough to stop waiting for a better one. */
const PRECISE_ENOUGH_METERS = 50;
const PRECISE_TIMEOUT_MS = 8_000;
const COARSE_TIMEOUT_MS = 15_000;
/** Oldest fix the coarse stage will accept, in milliseconds. */
const MAX_FIX_AGE_MS = 60_000;

/**
 * Whether the page is allowed to ask for location at all.
 *
 * Browsers disable geolocation outside a secure context, and the refusal
 * arrives as PERMISSION_DENIED — indistinguishable from a real block, which
 * sends people to a settings screen that cannot possibly help them. Only
 * localhost is exempt, so this catches a site served over plain http, which is
 * otherwise an invisible cause.
 */
export function isSecureContextOk(): boolean {
  if (typeof window === 'undefined') return true;
  return window.isSecureContext !== false;
}

function toGeolocationError(error: GeolocationPositionError): GeolocationError {
  if (error.code === error.PERMISSION_DENIED) {
    return new GeolocationError(
      'DENIED',
      'Location access is blocked for this site.',
    );
  }
  if (error.code === error.TIMEOUT) {
    return new GeolocationError('TIMEOUT', 'Timed out finding your location.');
  }
  return new GeolocationError(
    'UNAVAILABLE',
    'Your location could not be determined.',
  );
}

/**
 * Stage one: hold out briefly for a precise fix, but take what arrives.
 *
 * watchPosition rather than getCurrentPosition, because the two browsers fail
 * in opposite directions. Android tends to resolve getCurrentPosition on the
 * first coarse reading and stop looking; iOS tends to sit on the timeout even
 * when a usable fix landed after two seconds. Watching lets us take a good fix
 * the moment it appears and settle for the best seen when time runs out —
 * which beats returning nothing at all.
 */
function acquirePrecise(): Promise<GeolocationFix> {
  return new Promise((resolve, reject) => {
    let best: GeolocationFix | null = null;
    let watchId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (fix: GeolocationFix | null, error?: GeolocationError) => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timer) clearTimeout(timer);
      if (fix) resolve(fix);
      else reject(error ?? new GeolocationError('TIMEOUT', 'No fix arrived.'));
    };

    timer = setTimeout(() => finish(best), PRECISE_TIMEOUT_MS);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const fix = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        if (!best || fix.accuracy < best.accuracy) best = fix;
        if (fix.accuracy <= PRECISE_ENOUGH_METERS) finish(fix);
      },
      (error) => finish(null, toGeolocationError(error)),
      { enableHighAccuracy: true, timeout: PRECISE_TIMEOUT_MS, maximumAge: 0 },
    );
  });
}

/**
 * Stage two: ask for the cheap fix instead.
 *
 * Dropping high accuracy is what lets a phone fall back to the fused
 * Wi-Fi and cell provider, which answers in seconds indoors where satellites
 * never will. That reading is vague, but the server now judges vagueness
 * rather than refusing it.
 */
function acquireCoarse(): Promise<GeolocationFix> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // maximumAge lets the browser hand back a stored fix, so check the age
        // rather than trusting the option: a position from an hour ago says
        // nothing about where someone is standing now. A minute is roughly
        // eighty walking metres — the size of the fence itself — so it cannot
        // carry anyone in from across town.
        if (Date.now() - position.timestamp > MAX_FIX_AGE_MS) {
          reject(
            new GeolocationError('TIMEOUT', 'Only a stale position was found.'),
          );
          return;
        }
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => reject(toGeolocationError(error)),
      {
        enableHighAccuracy: false,
        timeout: COARSE_TIMEOUT_MS,
        maximumAge: MAX_FIX_AGE_MS,
      },
    );
  });
}

/**
 * Get a position, trying twice in different ways.
 *
 * One attempt at high accuracy with no tolerance for a cached fix is the
 * combination most likely to fail indoors: it waits for a satellite fix that
 * is not coming, then gives up. A denial is terminal — nothing about a second
 * attempt changes a permission — so only a timeout or an unavailable provider
 * falls through to the coarse stage.
 */
export async function acquireLocation(options?: {
  onStage?: (stage: 'precise' | 'coarse') => void;
}): Promise<GeolocationFix> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new GeolocationError(
      'UNSUPPORTED',
      'This browser cannot share your location.',
    );
  }

  if (!isSecureContextOk()) {
    throw new GeolocationError(
      'INSECURE',
      'This page is not on a secure connection, so the browser will not share your location.',
    );
  }

  options?.onStage?.('precise');
  try {
    return await acquirePrecise();
  } catch (err) {
    const reason = err instanceof GeolocationError ? err.reason : 'UNAVAILABLE';
    if (reason === 'DENIED' || reason === 'UNSUPPORTED') throw err;

    options?.onStage?.('coarse');
    return acquireCoarse();
  }
}

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
