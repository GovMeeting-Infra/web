'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, RefreshCw, MapPin } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useCurrentUser } from '@/components/SessionProvider';
import type { EventDetail, CheckInCodeResponse } from '@/lib/types/events';

export default function CheckInCodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const [countdown, setCountdown] = useState<string>('');

  const { data: event, isLoading: isEventLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => apiFetch<EventDetail>(`/api/v1/events/${id}`),
  });

  const {
    data: qrCode,
    isLoading,
    error: qrError,
  } = useQuery({
    queryKey: ['checkin-code', id],
    queryFn: () => apiFetch<CheckInCodeResponse>(`/api/v1/checkin-code/${id}`),
    // Server mints a 5-minute token and advertises refreshAt at +4 minutes;
    // poll on that cadence so the displayed code never goes stale.
    refetchInterval: 4 * 60 * 1000,
  });

  useEffect(() => {
    if (!qrCode) return;
    const expiresAt = new Date(qrCode.expiresAt).getTime();
    let refetched = false;

    const tick = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        setCountdown('Expired — fetching a new code…');
        // Guard so this fires once per token, not on every tick.
        if (!refetched) {
          refetched = true;
          queryClient.invalidateQueries({ queryKey: ['checkin-code', id] });
        }
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
  }, [qrCode, id, queryClient]);

  // GET /checkin-code/:eventId is behind CanManageEventGuard: organizer or SUPER_ADMIN.
  const canViewCode =
    !!currentUser &&
    (currentUser.id === event?.organizerId || currentUser.systemRole === 'SUPER_ADMIN');

  if (isEventLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  }

  if (!canViewCode) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Only the event organizer can view the check-in QR code.</p>
        <Link href={`/administrative/events/${id}`} className="mt-4 inline-block text-primary">
          Back to event
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-8">
      <Link href={`/administrative/events/${id}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Event
      </Link>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-ring">Check-In</p>
        <h1 className="text-3xl font-bold text-primary">QR Code</h1>
        <p className="mt-2 text-muted-foreground">Scan this code for attendees to check in</p>
      </div>

      {qrError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {qrError instanceof Error ? qrError.message : 'Failed to load the check-in code.'}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-[1.75rem] border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">Loading QR code...</p>
        </div>
      ) : qrCode ? (
        <div className="rounded-[1.75rem] border border-border bg-card p-12 space-y-8">
          <div className="flex justify-center">
            <div className="rounded-2xl border-4 border-border bg-white p-6">
              <QRCodeSVG
                value={qrCode.qrCodeUrl}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-foreground">{countdown}</p>
            <p className="text-xs text-muted-foreground">
              Token automatically refreshes every ~4 minutes
            </p>
          </div>

          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['checkin-code', id] })}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border bg-muted px-4 py-3 font-medium text-foreground hover:bg-border"
          >
            <RefreshCw className="h-4 w-4" /> Refresh Manually
          </button>

          {/* Geofence is the alternative to scanning, when the venue has
              coordinates set. */}
          <div className="rounded-2xl border border-border bg-muted/40 p-5">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                Location-based entry
              </h2>
            </div>

            {qrCode.geofenceEnabled ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Attendees inside the venue geofence can check in without scanning.
                  Their device location is verified on arrival.
                </p>
                <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div className="flex gap-2">
                    <dt className="font-medium text-foreground">Radius:</dt>
                    <dd>{qrCode.geofenceRadius ?? 100} m</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-medium text-foreground">Centre:</dt>
                    <dd>
                      {qrCode.venueLat}, {qrCode.venueLng}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Not configured for this event, so attendees must scan the QR code.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-[1.75rem] border border-border bg-card p-12 text-center text-muted-foreground">
          Failed to load QR code.
        </div>
      )}
    </div>
  );
}
