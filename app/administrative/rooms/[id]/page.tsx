'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  MapPin,
  Users,
  Calendar,
  AlertCircle,
  CalendarClock,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import {
  BOOKING_PURPOSE_LABELS,
  type Room,
  type RoomBooking,
} from '@/lib/types/rooms';
import type { EventListResponse } from '@/lib/types/events';
import { PageContainer } from '@/components/ui/page-container';
import { DetailSkeleton } from '@/components/ui/skeletons';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function formatRange(startISO: string, endISO: string) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const t = { hour: '2-digit', minute: '2-digit' } as const;
  return {
    date: start.toLocaleDateString(undefined, { dateStyle: 'medium' }),
    time: `${start.toLocaleTimeString(undefined, t)} – ${end.toLocaleTimeString(undefined, t)}`,
  };
}

export default function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const now = new Date();
  const from = now.toISOString();
  const to = new Date(now.getTime() + NINETY_DAYS_MS).toISOString();

  const { data: room, isLoading, error } = useQuery({
    queryKey: ['room', id],
    queryFn: () => apiFetch<Room>(`/api/v1/rooms/${id}`),
    retry: false,
  });

  const { data: bookings = [], error: bookingsError } = useQuery({
    queryKey: ['room-bookings', id],
    queryFn: () =>
      apiFetch<RoomBooking[]>(
        `/api/v1/rooms/${id}/bookings?${new URLSearchParams({
          startDate: from,
          endDate: to,
        }).toString()}`,
      ),
    enabled: !!room,
  });

  // Events occupying this room, via the roomId filter added for these pages.
  const { data: eventsResponse, error: eventsError } = useQuery({
    queryKey: ['room-events', id],
    queryFn: () =>
      apiFetch<EventListResponse>(
        `/api/v1/events?${new URLSearchParams({
          roomId: id,
          from,
          to,
          sortBy: 'startAt',
          order: 'asc',
        }).toString()}`,
      ),
    enabled: !!room,
  });

  const events = eventsResponse?.data ?? [];

  if (isLoading) {
    return (
      <PageContainer>
        <DetailSkeleton label="Loading room" />
      </PageContainer>
    );
  }

  if (error || !room) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : 'Room not found.'}
        </p>
        <Link href="/administrative/rooms" className="mt-4 inline-block text-primary">
          Back to rooms
        </Link>
      </div>
    );
  }

  return (
    <PageContainer>
      <Link
        href="/administrative/rooms"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Rooms
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">{room.name}</h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {room.location}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {room.capacity} capacity
            </span>
          </div>
        </div>

        {/* Booking happens through activity scheduling, so link there directly. */}
        <Link
          href="/administrative/events/new"
          className="flex shrink-0 items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_8px_16px_rgba(0,53,128,0.24)] transition-all hover:shadow-[0_12px_24px_rgba(0,53,128,0.32)]"
        >
          <CalendarClock className="h-4 w-4" />
          Book Room
        </Link>
      </div>

      {room.amenities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {room.amenities.map((a) => (
            <span
              key={a}
              className="rounded-full border border-[#c9d9f2] bg-[#edf3fd] px-3 py-1 text-xs font-medium text-[#003580]"
            >
              {a}
            </span>
          ))}
        </div>
      )}

      {bookings.length > 0 && events.length > 0 && (
        <div className="flex gap-3 rounded-xl border border-[#fde8a6] bg-[#fff8e5] p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-[#8d6400]" />
          <div className="text-sm">
            <p className="font-semibold text-[#8d6400]">Booking &amp; Event Overlap</p>
            <p className="mt-0.5 text-[#8d6400]/90">
              This room has both bookings and scheduled events. Make sure times
              don&apos;t conflict.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Bookings */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Room Bookings
          </h2>

          {bookingsError ? (
            // Never fall through to "no bookings" on a failure — an empty list
            // and a refused request must not look the same.
            <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              Couldn&apos;t load bookings:{' '}
              {bookingsError instanceof Error ? bookingsError.message : 'request failed'}
            </p>
          ) : bookings.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No upcoming bookings</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {bookings.map((b) => {
                const { date, time } = formatRange(b.startTime, b.endTime);
                return (
                  <li key={b.id} className="py-3">
                    <p className="text-sm font-medium text-foreground">
                      {BOOKING_PURPOSE_LABELS[b.purpose] ?? b.purpose}
                    </p>
                    {b.bookedBy && (
                      <p className="text-xs text-muted-foreground">
                        {b.bookedBy.name} · {b.bookedBy.email}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {date} · {time}
                    </p>
                    {b.attendeeCount > 0 && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {b.attendeeCount} attendees
                      </p>
                    )}
                    {b.notes && (
                      <p className="mt-1 text-xs italic text-muted-foreground">
                        &ldquo;{b.notes}&rdquo;
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Events */}
        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Scheduled Events
          </h2>

          {eventsError ? (
            <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              Couldn&apos;t load events:{' '}
              {eventsError instanceof Error ? eventsError.message : 'request failed'}
            </p>
          ) : events.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No scheduled events</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {events.map((e) => {
                const { date, time } = formatRange(e.startAt, e.endAt);
                return (
                  <li key={e.id}>
                    <Link
                      href={`/administrative/events/${e.id}`}
                      className="-mx-2 block rounded-lg px-2 py-3 transition-colors hover:bg-muted/50"
                    >
                      <p className="text-sm font-medium text-foreground">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.organizer?.name ?? 'System'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {date} · {time}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
