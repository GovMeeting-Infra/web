'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, MapPin, Users, AlertCircle, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import {
  BOOKING_PURPOSE_LABELS,
  overlaps,
  type Occupancy,
  type Room,
  type RoomBooking,
} from '@/lib/types/rooms';
import type { EventListResponse } from '@/lib/types/events';

const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 20;
const SLOT_MINUTES = 30;

/** YYYY-MM-DD in local time. */
function toDateParam(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateParam(value: string | null): Date {
  if (value) {
    const [y, m, d] = value.split('-').map(Number);
    if (y && m && d) {
      const parsed = new Date(y, m - 1, d);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function AvailabilityView() {
  const router = useRouter();
  const params = useSearchParams();

  const roomId = params.get('roomId') ?? '';
  const date = parseDateParam(params.get('date'));
  const dateParam = toDateParam(date);

  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms-list'],
    queryFn: () => apiFetch<Room[]>('/api/v1/rooms'),
  });

  const selectedRoom = rooms.find((r) => r.id === roomId) ?? null;

  const { data: bookings = [], error: bookingsError } = useQuery({
    queryKey: ['availability-bookings', roomId, dateParam],
    queryFn: () =>
      apiFetch<RoomBooking[]>(
        `/api/v1/rooms/${roomId}/bookings?${new URLSearchParams({
          startDate: startOfDay.toISOString(),
          endDate: endOfDay.toISOString(),
        }).toString()}`,
      ),
    enabled: !!roomId,
  });

  // Events occupy a room just as bookings do. Availability used to ignore them
  // entirely, so a room hosting an event still showed every slot as free.
  const { data: eventsResponse, error: eventsError } = useQuery({
    queryKey: ['availability-events', roomId, dateParam],
    queryFn: () =>
      apiFetch<EventListResponse>(
        `/api/v1/events?${new URLSearchParams({
          roomId,
          from: startOfDay.toISOString(),
          to: endOfDay.toISOString(),
          sortBy: 'startAt',
          order: 'asc',
        }).toString()}`,
      ),
    enabled: !!roomId,
  });

  const occupancy: Occupancy[] = [
    ...bookings.map((b) => ({
      id: b.id,
      kind: 'booking' as const,
      title: `Booking: ${BOOKING_PURPOSE_LABELS[b.purpose] ?? b.purpose}`,
      who: b.bookedBy?.name ?? null,
      start: new Date(b.startTime),
      end: new Date(b.endTime),
    })),
    ...(eventsResponse?.data ?? []).map((e) => ({
      id: e.id,
      kind: 'event' as const,
      title: e.title,
      who: e.organizer?.name ?? null,
      start: new Date(e.startAt),
      end: new Date(e.endAt),
    })),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  const slots = [];
  for (let h = SLOT_START_HOUR; h < SLOT_END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      const slotStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
      const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60 * 1000);
      const busy = occupancy.some((o) =>
        overlaps(slotStart, slotEnd, o.start, o.end),
      );
      slots.push({ start: slotStart, end: slotEnd, busy });
    }
  }

  const navigate = (next: { roomId?: string; date?: string }) => {
    const qs = new URLSearchParams();
    qs.set('roomId', next.roomId ?? roomId);
    qs.set('date', next.date ?? dateParam);
    router.push(`/administrative/rooms/availability?${qs.toString()}`);
  };

  const timeOpts = { hour: '2-digit', minute: '2-digit' } as const;

  return (
    <div className="w-full space-y-6 p-8">
      <Link
        href="/administrative/rooms"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Rooms
      </Link>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-ring">
          Facilities management
        </p>
        <h1 className="text-3xl font-bold text-primary">Room Availability</h1>
        <p className="mt-2 text-muted-foreground">
          Check when a room is free before scheduling.
        </p>
      </div>

      <div className="rounded-[1.5rem] border border-border bg-card p-6">
        <label className="text-sm font-medium text-foreground/80">Room</label>
        <select
          value={roomId}
          onChange={(e) => navigate({ roomId: e.target.value })}
          className="mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none"
        >
          <option value="">Choose a room…</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.capacity} people) — {r.location}
            </option>
          ))}
        </select>
      </div>

      {!selectedRoom ? (
        <p className="rounded-[1.5rem] border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Select a room to see its availability.
        </p>
      ) : (
        <>
          <div className="rounded-[1.5rem] border border-border bg-card p-6">
            <h2 className="font-semibold text-primary">{selectedRoom.name}</h2>
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> Location
                </dt>
                <dd className="mt-1 text-sm text-foreground">{selectedRoom.location}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Capacity
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {selectedRoom.capacity} people
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5" /> Conflicts
                </dt>
                <dd className="mt-1 text-sm text-foreground">{occupancy.length}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[1.5rem] border border-border bg-card p-6">
            <label className="text-sm font-medium text-foreground/80">Date</label>
            <input
              type="date"
              value={dateParam}
              onChange={(e) => navigate({ date: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-[#d7e5fb] sm:w-auto"
            />
          </div>

          {/* If either source failed we cannot claim a slot is free — say so
              rather than rendering a confidently wrong grid. */}
          {(bookingsError || eventsError) && (
            <div className="flex gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Availability may be incomplete</p>
                <p className="mt-0.5">
                  {bookingsError instanceof Error
                    ? `Bookings: ${bookingsError.message}. `
                    : ''}
                  {eventsError instanceof Error
                    ? `Events: ${eventsError.message}.`
                    : ''}{' '}
                  Slots below may show as available when they are not.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-[1.5rem] border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground">
              Available Time Slots &mdash;{' '}
              {date.toLocaleDateString(undefined, { dateStyle: 'full' })}
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {slots.map((s) => (
                <div
                  key={s.start.toISOString()}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                    s.busy
                      ? 'border-[#f8b4b4] bg-[#fde8e8] text-[#9b1c1c]'
                      : 'border-[#cfe5d7] bg-[#edf8f1] text-[#007236]'
                  }`}
                >
                  <span className="font-medium">
                    {s.start.toLocaleTimeString(undefined, timeOpts)} –{' '}
                    {s.end.toLocaleTimeString(undefined, timeOpts)}
                  </span>
                  <span className="text-xs font-semibold">
                    {s.busy ? 'Booked' : 'Available'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {occupancy.length > 0 && (
            <div className="rounded-[1.5rem] border border-border bg-card p-6">
              <h2 className="text-sm font-semibold text-foreground">
                Booked Times &mdash;{' '}
                {date.toLocaleDateString(undefined, { dateStyle: 'medium' })}
              </h2>

              <ul className="mt-4 space-y-2">
                {occupancy.map((o) => (
                  <li
                    key={`${o.kind}-${o.id}`}
                    className={`rounded-lg border px-4 py-3 text-sm ${
                      o.kind === 'booking'
                        ? 'border-[#fde8a6] bg-[#fff8e5] text-[#8d6400]'
                        : 'border-[#c9d9f2] bg-[#edf3fd] text-[#003580]'
                    }`}
                  >
                    <p className="font-medium">{o.title}</p>
                    {o.who && <p className="text-xs opacity-80">By: {o.who}</p>}
                    <p className="mt-0.5 text-xs opacity-80">
                      {o.start.toLocaleTimeString(undefined, timeOpts)} –{' '}
                      {o.end.toLocaleTimeString(undefined, timeOpts)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link
            href="/administrative/events/new"
            className="inline-flex items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_8px_16px_rgba(0,53,128,0.24)] transition-all hover:shadow-[0_12px_24px_rgba(0,53,128,0.32)]"
          >
            <Plus className="h-4 w-4" />
            Schedule Activity in This Room
          </Link>
        </>
      )}
    </div>
  );
}

export default function RoomAvailabilityPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-muted-foreground">Loading…</div>
      }
    >
      <AvailabilityView />
    </Suspense>
  );
}
