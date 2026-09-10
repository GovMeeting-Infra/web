'use client';

import { idbGet, idbSet } from './db';

/**
 * How far this device's clock is from the server's.
 *
 * Not paranoia. The stated failure mode includes power cuts, which is exactly
 * what resets the real-time clock on a cheap tablet — and a check-in stamped
 * with the time that tablet believed it was would put an attendee in a meeting
 * that had not happened yet, or one from last year.
 *
 * Learned from the Date header of any successful response, which every request
 * already carries and nobody has to be asked for.
 */

const OFFSET_KEY = 'clock-offset-ms';

/** Kept in memory so the common path costs nothing. */
let offsetMs = 0;
let loaded = false;

/**
 * Ignore an offset large enough to be nonsense rather than drift.
 *
 * A year of skew is a broken clock, and trusting it would move every queued
 * write to a wrong time with great confidence. Better to record the times as
 * the device saw them and let the server clamp, which it can do against the
 * meeting it actually belongs to.
 */
const MAX_PLAUSIBLE_SKEW_MS = 365 * 24 * 60 * 60 * 1000;

export async function loadClockOffset(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const stored = await idbGet<number>('meta', OFFSET_KEY);
  if (typeof stored === 'number' && Number.isFinite(stored)) offsetMs = stored;
}

/**
 * Note what the server thinks the time is.
 *
 * The round trip makes this imprecise by up to the latency of one request,
 * which on the connections this runs over can be seconds. That is fine: this
 * exists to catch a clock that is wrong by hours or years, not to synchronise
 * one that is wrong by a second.
 */
export function observeServerDate(header: string | null): void {
  if (!header) return;
  const serverTime = Date.parse(header);
  if (Number.isNaN(serverTime)) return;

  const skew = serverTime - Date.now();
  if (Math.abs(skew) > MAX_PLAUSIBLE_SKEW_MS) return;

  offsetMs = skew;
  void idbSet('meta', OFFSET_KEY, skew);
}

/** The current time, corrected by whatever the server last implied. */
export function now(): Date {
  return new Date(Date.now() + offsetMs);
}

/** How wrong this device's own clock appears to be, for the server to record. */
export function clockSkewMs(): number {
  return offsetMs;
}
