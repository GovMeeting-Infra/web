'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, RefreshCw, MapPin, QrCode, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import {
  acquireAnchorLocation,
  GeolocationError,
} from '@/lib/hooks/useGeolocation';
import type { CheckInCodeResponse, EventDetail } from '@/lib/types/events';
import { PageContainer } from '@/components/ui/page-container';
import { CardSkeleton } from '@/components/ui/skeletons';
import { Tooltip } from '@/components/ui/tooltip';
import { useTransientMessage } from '@/lib/hooks/useTransientMessage';

interface GeneratePayload {
  lat?: number;
  lng?: number;
  gpsAccuracy?: number;
  resetAnchor?: boolean;
  rotate?: boolean;
}

export default function CheckInCodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [notice, setNotice] = useTransientMessage();
  const [actionError, setActionError] = useTransientMessage();

  // Set when the organizer closes check-in, so the page can say the code was
  // revoked rather than leaving an empty screen with no explanation.
  const [checkInClosed, setCheckInClosed] = useState(false);

  // While the organizer's position settles: whether we are waiting, and the
  // accuracy of the best reading so far.
  const [locating, setLocating] = useState(false);
  const [locatingAccuracy, setLocatingAccuracy] = useState<number | null>(
    null,
  );

  const {
    data: qrCode,
    isLoading,
    error: qrError,
  } = useQuery({
    queryKey: ['checkin-code', id],
    queryFn: () => apiFetch<CheckInCodeResponse>(`/api/v1/checkin-code/${id}`),
    // Never polls. This endpoint is a pure read now; generating is an explicit
    // act, and an idle tab must not mint tokens.
    refetchInterval: false,
  });

  // Same query key as the event page, so arriving from there is a cache hit
  // rather than a second round trip. Needed here only to decide whether a code
  // can be generated at all.
  const { data: event } = useQuery({
    queryKey: ['event', id],
    queryFn: () => apiFetch<EventDetail>(`/api/v1/events/${id}`),
  });

  // Mirrors issueCheckInCode on the server, which refuses both of these. The
  // button used to stay live and the refusal arrived as an error after the
  // click — worth knowing before pressing, not after.
  const geofence = qrCode?.geofence;

  const hasEnded = !!event && new Date(event.endAt) < new Date();
  const notPublished =
    !!event && (event.status === 'DRAFT' || event.status === 'CANCELLED');

  // The server only issues a code from a set time before the meeting starts,
  // so the area is set at the venue on the day. Re-rendered when that moment
  // arrives, so a page opened early does not need reloading.
  const opensAtMs = qrCode?.codeOpensAt
    ? new Date(qrCode.codeOpensAt).getTime()
    : null;
  const [, setTick] = useState(0);
  useEffect(() => {
    if (opensAtMs == null) return;
    const wait = opensAtMs - Date.now();
    if (wait <= 0) return;
    // setTimeout overflows past ~24.8 days; nobody keeps the tab open that long.
    const t = setTimeout(
      () => setTick((n) => n + 1),
      Math.min(wait + 500, 2 ** 31 - 1),
    );
    return () => clearTimeout(t);
  }, [opensAtMs]);
  const notOpenYet = opensAtMs != null && new Date(opensAtMs) > new Date();

  const cannotGenerate = hasEnded || notPublished || notOpenYet;

  const opensAtText =
    opensAtMs != null
      ? new Date(opensAtMs).toLocaleString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: 'numeric',
          minute: '2-digit',
        })
      : null;

  /** Why generating is unavailable, or null when it is. */
  const blockedReason = hasEnded
    ? 'This meeting has ended, so a check-in code can no longer be generated.'
    : event?.status === 'CANCELLED'
      ? 'This meeting was cancelled, so a check-in code cannot be generated.'
      : event?.status === 'DRAFT'
        ? 'Publish this event before generating a check-in code.'
        : notOpenYet
          ? `Available from ${opensAtText}, two hours before the meeting. Generate it at the venue: your location sets the check-in area for this day only.`
          : null;

  const generate = useMutation({
    mutationFn: (body: GeneratePayload) =>
      apiFetch<CheckInCodeResponse>(`/api/v1/checkin-code/${id}`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      // Write straight into the cache so the countdown recomputes without a
      // second round trip.
      queryClient.setQueryData(['checkin-code', id], data);
      setActionError(null);
    },
    onError: (err) =>
      setActionError(
        err instanceof Error ? err.message : 'Could not generate a code.',
      ),
  });

  const closeCheckIn = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/checkin-code/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setCheckInClosed(true);
      queryClient.invalidateQueries({ queryKey: ['checkin-code', id] });
      setNotice('Check-in closed. Existing codes no longer work.');
    },
    onError: (err) =>
      setActionError(
        err instanceof Error ? err.message : 'Could not close check-in.',
      ),
  });

  /**
   * When the code stops working, as a sentence rather than a countdown.
   *
   * There used to be a clock here, because the code lasted five minutes and
   * was replaced over and over. That made the organizer responsible for
   * watching it: anyone who arrived while the screen showed a dead code could
   * not get in. One code now lasts the whole meeting, so the only thing worth
   * saying is when check-in closes.
   */
  const closesAt = event?.endAt
    ? new Date(event.endAt).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  // The code and the meeting end together, so a code still on screen after
  // that is spent — check-in refuses a scan once the meeting is over whatever
  // the code says.
  const expired =
    !!qrCode?.expiresAt && new Date(qrCode.expiresAt) <= new Date();

  /**
   * Capture the organizer's location and generate.
   *
   * There is no way round a missing location: the server refuses to issue a
   * code without a check-in area, and refuses to move an area to a fix it
   * cannot trust. This used to offer "generate without location verification",
   * which the server then declined — so the offer was a dead end, and on a
   * reset it was the path that wiped the area.
   */
  const generateWithLocation = async (extra: GeneratePayload = {}) => {
    setActionError(null);
    setNotice(null);
    // Asking for a code is the opposite of closing check-in.
    setCheckInClosed(false);
    setLocating(true);
    setLocatingAccuracy(null);

    try {
      const fix = await acquireAnchorLocation({
        onProgress: setLocatingAccuracy,
      });
      generate.mutate({
        lat: fix.latitude,
        lng: fix.longitude,
        gpsAccuracy: fix.accuracy,
        ...extra,
      });
    } catch (err) {
      const reason =
        err instanceof GeolocationError ? err.message : 'Location unavailable.';
      setActionError(
        extra.resetAnchor && geofence?.enabled
          ? `${reason} The check-in area has not been moved.`
          : `${reason} A check-in code needs your location to set the area attendees must be inside. If you cannot share it, record people at the desk from the attendees page instead.`,
      );
    } finally {
      setLocating(false);
      setLocatingAccuracy(null);
    }
  };

  const busy = locating || generate.isPending || closeCheckIn.isPending;

  /** What the generate buttons say while they work. */
  const workingLabel = locating
    ? locatingAccuracy != null
      ? `Getting a precise location… ±${Math.round(locatingAccuracy)} m`
      : 'Getting your location…'
    : null;

  if (isLoading) {
    return (
      <PageContainer>
        <CardSkeleton lines={4} label="Loading check-in code" />
      </PageContainer>
    );
  }

  // The server is the authority on who may manage this event (organizer,
  // co-organizers, ministry admins on ownerless events, super admin). The old
  // client-side predicate here duplicated a narrower rule and wrongly locked
  // out people the API allows.
  if (qrError) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">
          {qrError instanceof Error
            ? qrError.message
            : 'You cannot manage the check-in code for this event.'}
        </p>
        <Link
          href={`/administrative/events/${id}`}
          className="mt-4 inline-block text-primary"
        >
          Back to event
        </Link>
      </div>
    );
  }

  return (
    <PageContainer className="space-y-8">
      <Link
        href={`/administrative/events/${id}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Event
      </Link>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-success">
          Check-In
        </p>
        <h1 className="text-3xl font-bold text-primary">QR Code</h1>
        <p className="mt-2 text-muted-foreground">
          One code for the whole meeting. Generate it in the room, on the day.
        </p>
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {actionError}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-ring/20 bg-stat-green-bg p-4 text-sm text-success">
          {notice}
        </div>
      )}

      {!qrCode?.token ? (
        // The empty state is one call to action, so it stays a narrow centred
        // column rather than stretching a single button across the page.
        <div className="mx-auto max-w-xl space-y-5 rounded-[1.75rem] border border-border bg-card p-6 text-center sm:p-12">
          <QrCode className="mx-auto h-12 w-12 text-muted-foreground" />
          <div>
            <h2 className="font-semibold text-foreground">
              {hasEnded ? 'No code was generated' : 'No check-in code yet'}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              {/* The reason takes the place of the instructions when there is
                  nothing to instruct — a disabled button with the usual "do
                  this at the venue" copy above it reads as a fault. */}
              {blockedReason ?? (
                <>
                  Generate this at the venue. Your current location becomes
                  the check-in area for this day only: attendees must be within{' '}
                  {geofence?.radiusMeters ?? 100} m of where you stand now.
                  {event?.seriesId && (
                    <>
                      {' '}
                      Each day of this series needs its own code, generated
                      where that day&apos;s meeting is held.
                    </>
                  )}
                  {geofence?.required && (
                    <>
                      {' '}
                      This meeting requires location verification, so a code
                      cannot be generated until your signal is accurate enough
                      to fix the area.
                    </>
                  )}
                </>
              )}
            </p>
          </div>
          <button
            onClick={() => generateWithLocation()}
            disabled={busy || cannotGenerate}
            // disabled:cursor-not-allowed as well as the dimming: the pointer
            // is what tells you a control is unavailable before you click it.
            className="inline-flex items-center gap-2 rounded-[1.25rem] bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:opacity-50"
          >
            <QrCode className="h-4 w-4" />
            {workingLabel ?? (generate.isPending ? 'Generating…' : 'Generate QR code')}
          </button>
        </div>
      ) : (
        // Two columns once there is room: the code itself on the left, and
        // everything you do to it on the right. Centring a 256px code in a
        // full-width card would leave it stranded in the middle of the page.
        <div className="grid items-start gap-6 rounded-[1.75rem] border border-border bg-card p-4 sm:gap-10 sm:p-8 lg:grid-cols-2 lg:p-12">
          <div className="flex flex-col items-center gap-4">
            {/* max-w rather than a second fixed size: an SVG QR scales without
                loss, and at 256px plus this card's and the page's padding the
                code was 472px wide on a 375px screen — a quarter of it cut
                off, on the page whose whole job is being pointed at. */}
            {/* A dead code looks exactly like a live one, so it is covered
                rather than left to be pointed at. That now only happens once
                the meeting is over or check-in has been closed by hand. */}
            <div className="relative w-full max-w-[18rem]">
              <div className="rounded-2xl border-4 border-border bg-white p-3 sm:p-6">
                <QRCodeSVG
                  value={qrCode.qrCodeUrl!}
                  size={256}
                  level="H"
                  includeMargin={true}
                  className="h-auto w-full"
                  title="Check-in QR code"
                />
              </div>
              {expired && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-scrim/75 p-4 text-center">
                  <span className="text-base font-bold text-white">
                    {checkInClosed ? 'Check-in is closed' : 'Check-in has ended'}
                  </span>
                  <span className="text-sm text-white/85">
                    {cannotGenerate
                      ? 'Ask a ministry admin to reopen check-in.'
                      : checkInClosed
                        ? 'Tap New code below to reopen it.'
                        : 'This meeting is over. Record anyone missed from the attendees page.'}
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-1 text-center">
              {/* One line, and it does not tick. Nobody has to watch this. */}
              <p
                className={
                  expired
                    ? 'text-lg font-bold text-alert-fg'
                    : 'text-sm font-medium text-foreground'
                }
              >
                {expired
                  ? checkInClosed
                    ? 'Check-in closed'
                    : 'Check-in has ended'
                  : closesAt
                    ? `Works until the meeting ends at ${closesAt}`
                    : 'Works for the whole meeting'}
              </p>
              <p className="text-xs text-muted-foreground">
                {expired
                  ? 'Tap New code below to issue another.'
                  : 'One code for the whole meeting — leave it up, or print it. Use New code only if it has been shared outside the room.'}
              </p>
              {/* Announced when it changes, which is now once. A per-second
                  live region would talk over everything else on the page. */}
              <span role="status" aria-live="polite" className="sr-only">
                {expired ? 'Check-in is closed for this meeting.' : ''}
              </span>
              {/* The code as text. Someone whose camera will not focus, or who
                  is reading this aloud down a phone line, has no other way in. */}
              <p className="pt-1 text-xs break-all text-muted-foreground">
                Or open{' '}
                <span className="font-medium text-foreground">
                  {qrCode.qrCodeUrl}
                </span>
              </p>
            </div>
          </div>

          <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Tooltip
              content={
                blockedReason ??
                'Issues a different code and stops the one on screen working. For a code that has been shared outside the room — nothing needs replacing otherwise. The check-in area stays where it was set, so doing this from the corridor does not drag it with you.'
              }
            >
            <button
              onClick={() => {
                // Asked for, because it revokes the code people may be part way
                // through scanning. Nothing replaces a code on its own now, so
                // the only reason to be here is that one has got out.
                if (
                  qrCode?.token &&
                  !window.confirm(
                    'Replace this code? The one on screen stops working immediately, and anyone who has not checked in yet will need the new one.',
                  )
                )
                  return;
                setActionError(null);
                setNotice(null);
                setCheckInClosed(false);
                // Rotate only — the check-in area deliberately stays put, so a
                // code replaced from the corridor can't drag the fence along.
                generate.mutate({ rotate: true });
              }}
              // Same endpoint as generating, so it meets the same refusal once
              // the meeting is over. Closing check-in below stays available —
              // tidying up after the fact is still legitimate.
              disabled={busy || cannotGenerate}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-muted px-4 py-3 font-medium text-foreground hover:bg-border disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4" />
              {generate.isPending ? 'Working…' : 'New code'}
            </button>
            </Tooltip>

            <button
              onClick={() => {
                if (
                  !window.confirm(
                    'Close check-in? Existing QR codes will stop working immediately.',
                  )
                )
                  return;
                setActionError(null);
                closeCheckIn.mutate();
              }}
              disabled={busy}
              className="flex items-center justify-center gap-2 rounded-2xl border border-destructive/30 px-4 py-3 font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" /> Close check-in
            </button>
          </div>

          {/* Says why "New code" is dead, and why a spent code cannot be
              replaced. */}
          {blockedReason && (
            <p className="text-sm text-muted-foreground">{blockedReason}</p>
          )}

          <div className="rounded-2xl border border-border bg-muted/40 p-5">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                Check-in area
              </h2>
            </div>

            {geofence?.enabled ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Set from your location
                  {geofence.anchorSetAt
                    ? ` on ${new Date(geofence.anchorSetAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`
                    : ''}
                  . Attendees must be within {geofence.radiusMeters} m
                  {geofence.anchorAccuracy != null
                    ? ` (fix accurate to ±${geofence.anchorAccuracy} m)`
                    : ''}
                  .
                </p>
                <button
                  onClick={() => {
                    if (
                      !window.confirm(
                        'Move the check-in area to where you are now? People already checked in keep their record, but new arrivals will be measured from the new spot.',
                      )
                    )
                      return;
                    generateWithLocation({ resetAnchor: true });
                  }}
                  disabled={busy}
                  className="mt-3 text-xs font-medium text-primary underline underline-offset-2 disabled:opacity-50"
                >
                  {workingLabel ?? 'Reset check-in area'}
                </button>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  No location verification. Anyone with the code can check in,
                  and check-ins are recorded as unverified.
                </p>
                <button
                  onClick={() => generateWithLocation({ resetAnchor: true })}
                  disabled={busy}
                  className="mt-3 text-xs font-medium text-primary underline underline-offset-2 disabled:opacity-50"
                >
                  {workingLabel ?? 'Set check-in area from my location'}
                </button>
              </>
            )}
          </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
