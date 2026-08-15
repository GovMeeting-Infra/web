'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, RefreshCw, MapPin, QrCode, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { requestLocation, GeolocationError } from '@/lib/hooks/useGeolocation';
import type { CheckInCodeResponse, EventDetail } from '@/lib/types/events';
import { PageContainer } from '@/components/ui/page-container';
import { CardSkeleton } from '@/components/ui/skeletons';

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
  const [countdown, setCountdown] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
  const hasEnded = !!event && new Date(event.endAt) < new Date();
  const notPublished =
    !!event && (event.status === 'DRAFT' || event.status === 'CANCELLED');
  const cannotGenerate = hasEnded || notPublished;

  /** Why generating is unavailable, or null when it is. */
  const blockedReason = hasEnded
    ? 'This meeting has ended, so a check-in code can no longer be generated.'
    : event?.status === 'CANCELLED'
      ? 'This meeting was cancelled, so a check-in code cannot be generated.'
      : event?.status === 'DRAFT'
        ? 'Publish this event before generating a check-in code.'
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
      queryClient.invalidateQueries({ queryKey: ['checkin-code', id] });
      setNotice('Check-in closed. Existing codes no longer work.');
    },
    onError: (err) =>
      setActionError(
        err instanceof Error ? err.message : 'Could not close check-in.',
      ),
  });

  useEffect(() => {
    // No token means the countdown is not rendered at all, so there is nothing
    // to clear — and clearing here would be a synchronous setState in an
    // effect body.
    if (!qrCode?.expiresAt) return;
    const expiresAt = new Date(qrCode.expiresAt).getTime();

    const tick = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        // Telling someone to generate a new code next to a button that
        // refuses to is worse than saying nothing.
        setCountdown(cannotGenerate ? 'Expired' : 'Expired — generate a new code');
        return;
      }
      const total = Math.ceil(remaining / 1000);
      const mins = Math.floor(total / 60);
      const secs = total % 60;
      setCountdown(`Expires in ${mins}:${String(secs).padStart(2, '0')}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [qrCode, cannotGenerate]);

  /**
   * Capture the organizer's location and generate. When no fix is available we
   * still generate, but only after the organizer accepts what that costs —
   * silently minting an unfenced code would be a surprise.
   */
  const generateWithLocation = async (extra: GeneratePayload = {}) => {
    setActionError(null);
    setNotice(null);

    try {
      const fix = await requestLocation();
      generate.mutate({
        lat: fix.latitude,
        lng: fix.longitude,
        gpsAccuracy: fix.accuracy,
        ...extra,
      });
    } catch (err) {
      const reason =
        err instanceof GeolocationError ? err.message : 'Location unavailable.';
      const proceed = window.confirm(
        `${reason}\n\nGenerate a code without location verification? Attendees will be able to check in from anywhere, and their check-ins will be recorded as unverified.`,
      );
      if (!proceed) return;
      generate.mutate(extra);
    }
  };

  const busy = generate.isPending || closeCheckIn.isPending;
  const geofence = qrCode?.geofence;

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
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-ring">
          Check-In
        </p>
        <h1 className="text-3xl font-bold text-primary">QR Code</h1>
        <p className="mt-2 text-muted-foreground">
          Generate a code for attendees to scan
        </p>
      </div>

      {actionError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {actionError}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-ring/20 bg-[#edf8f1] p-4 text-sm text-ring">
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
                  Your current location becomes the check-in area. Attendees
                  must be within {geofence?.radiusMeters ?? 100} m of where you
                  stand now. Generate this at the venue.
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
            {generate.isPending ? 'Generating…' : 'Generate QR code'}
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
            <div className="w-full max-w-[18rem] rounded-2xl border-4 border-border bg-white p-3 sm:p-6">
              <QRCodeSVG
                value={qrCode.qrCodeUrl!}
                size={256}
                level="H"
                includeMargin={true}
                className="h-auto w-full"
              />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-sm font-medium text-foreground">{countdown}</p>
              <p className="text-xs text-muted-foreground">
                Codes last 5 minutes. Refresh before it expires.
              </p>
            </div>
          </div>

          <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => {
                setActionError(null);
                setNotice(null);
                // Rotate only — the check-in area deliberately stays put, so a
                // code refreshed from the corridor can't drag the fence along.
                generate.mutate({ rotate: true });
              }}
              // Rotating goes through the same endpoint, so it meets the same
              // refusal once the meeting is over. Closing check-in below stays
              // available — tidying up after the fact is still legitimate.
              disabled={busy || cannotGenerate}
              title={blockedReason ?? undefined}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-muted px-4 py-3 font-medium text-foreground hover:bg-border disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-muted"
            >
              <RefreshCw className="h-4 w-4" />
              {generate.isPending ? 'Working…' : 'New code'}
            </button>

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

          {/* Says why "New code" is dead, and explains a countdown that has
              run out and cannot be refreshed. */}
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
                  Reset check-in area
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
                  Set check-in area from my location
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
