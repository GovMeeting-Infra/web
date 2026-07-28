'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus, MapPin, Users, Calendar, DoorOpen, Pencil, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { ListSkeleton } from '@/components/ui/skeletons';
import { useCurrentUser } from '@/components/SessionProvider';
import { RoomForm } from '@/components/rooms/RoomForm';
import type { Room, CreateRoomInput } from '@/lib/types/rooms';

/** Mirrors the roles on POST/PATCH/DELETE admin/rooms. */
const ROOM_ADMIN_ROLES = ['SUPER_ADMIN', 'MINISTER', 'MINISTRY_ADMIN'];

function StatCard({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <div className={`rounded-[1.5rem] border p-6 ${tint}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
          {label}
        </p>
        {icon}
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}

export default function RoomsPage() {
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();

  const canManageRooms =
    !!currentUser && ROOM_ADMIN_ROLES.includes(currentUser.systemRole);
  const isSuperAdmin = currentUser?.systemRole === 'SUPER_ADMIN';

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: rooms, isLoading, error } = useQuery({
    queryKey: ['rooms-list'],
    queryFn: () => apiFetch<Room[]>('/api/v1/rooms'),
  });

  const refresh = () => {
    // The event form's room picker reads the same endpoint, so a room added or
    // removed here must show up there too.
    queryClient.invalidateQueries({ queryKey: ['rooms-list'] });
    queryClient.invalidateQueries({ queryKey: ['rooms'] });
  };

  const handleCreate = async (values: CreateRoomInput) => {
    await apiFetch('/api/v1/admin/rooms', {
      method: 'POST',
      body: JSON.stringify(values),
    });
    setShowAddForm(false);
    refresh();
  };

  const handleUpdate = async (values: CreateRoomInput) => {
    if (!editingRoom) return;
    const { ministryId: _ignored, ...patch } = values;
    await apiFetch(`/api/v1/admin/rooms/${editingRoom.id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    setEditingRoom(null);
    refresh();
  };

  const handleRemove = async (room: Room) => {
    if (confirmRemoveId !== room.id) {
      setConfirmRemoveId(room.id);
      return;
    }
    setActionError(null);
    try {
      await apiFetch(`/api/v1/admin/rooms/${room.id}`, { method: 'DELETE' });
      setConfirmRemoveId(null);
      refresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : `Failed to remove ${room.name}.`,
      );
    }
  };

  const totalRooms = rooms?.length ?? 0;
  const bookingsToday = (rooms ?? []).reduce((n, r) => n + (r.bookingsToday ?? 0), 0);
  const totalCapacity = (rooms ?? []).reduce((n, r) => n + r.capacity, 0);

  return (
    <div className="w-full space-y-8 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-ring">
            Facilities management
          </p>
          <h1 className="text-3xl font-bold text-primary">Room Booking</h1>
          <p className="mt-2 text-muted-foreground">
            Book conference rooms and spaces
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-3">
          {canManageRooms && (
            <button
              onClick={() => {
                setEditingRoom(null);
                setShowAddForm((v) => !v);
              }}
              className="flex items-center gap-2 rounded-[1.25rem] bg-primary px-6 py-3 font-medium text-primary-foreground shadow-[0_8px_16px_rgba(0,53,128,0.24)] transition-all hover:shadow-[0_12px_24px_rgba(0,53,128,0.32)]"
            >
              <Plus className="h-5 w-5" />
              Add Room
            </button>
          )}
          <Link
            href="/administrative/events/new"
            className="flex items-center gap-2 rounded-[1.25rem] border border-border bg-card px-6 py-3 font-medium text-foreground transition-colors hover:bg-muted"
          >
            Schedule Activity with Room
          </Link>
        </div>
      </div>

      {canManageRooms && showAddForm && (
        <RoomForm
          isSuperAdmin={isSuperAdmin}
          onSubmit={handleCreate}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {canManageRooms && editingRoom && (
        <RoomForm
          room={editingRoom}
          isSuperAdmin={isSuperAdmin}
          onSubmit={handleUpdate}
          onCancel={() => setEditingRoom(null)}
        />
      )}

      {actionError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Rooms"
          value={totalRooms}
          icon={<DoorOpen className="h-5 w-5 opacity-70" />}
          tint="border-[#c9d9f2] bg-[#edf3fd] text-[#003580]"
        />
        <StatCard
          label="Bookings Today"
          value={bookingsToday}
          icon={<Calendar className="h-5 w-5 opacity-70" />}
          tint="border-[#cfe5d7] bg-[#edf8f1] text-[#007236]"
        />
        <StatCard
          label="Total Capacity"
          value={totalCapacity}
          icon={<Users className="h-5 w-5 opacity-70" />}
          tint="border-[#fde8a6] bg-[#fff8e5] text-[#8d6400]"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load rooms'}
        </div>
      )}

      {isLoading && (
        <ListSkeleton rows={4} label="Loading rooms" />
      )}

      {!isLoading && rooms && rooms.length === 0 && (
        <div className="rounded-[1.75rem] border border-border bg-card p-12 text-center">
          <DoorOpen className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 font-medium text-foreground">No rooms available</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManageRooms
              ? 'Add a room to make it bookable when scheduling an activity.'
              : 'Contact your administrator to add rooms.'}
          </p>
        </div>
      )}

      {!isLoading && rooms && rooms.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            // The admin actions sit outside the Link — nesting buttons inside an
            // anchor would navigate instead of acting.
            <div
              key={room.id}
              className="flex flex-col rounded-[1.75rem] border border-border bg-card p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)] transition-all hover:border-primary/30 hover:shadow-[0_16px_40px_rgba(0,53,128,0.12)]"
            >
              <Link
                href={`/administrative/rooms/${room.id}`}
                className="flex flex-1 flex-col"
              >
                <h2 className="font-semibold text-primary">{room.name}</h2>

              <div className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="truncate">{room.location}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Users className="h-4 w-4 shrink-0" />
                  Capacity: {room.capacity} people
                </p>
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0" />
                  {room._count.bookings}{' '}
                  {room._count.bookings === 1 ? 'booking' : 'bookings'}
                </p>
              </div>

              {room.amenities.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {room.amenities.map((a) => (
                    <span
                      key={a}
                      className="rounded-full border border-[#c9d9f2] bg-[#edf3fd] px-2.5 py-0.5 text-xs font-medium text-[#003580]"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}

                <span className="mt-6 block rounded-lg bg-secondary px-3 py-2 text-center text-sm font-medium text-secondary-foreground">
                  View Availability
                </span>
              </Link>

              {canManageRooms && (
                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setConfirmRemoveId(null);
                      setEditingRoom(room);
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleRemove(room)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      confirmRemoveId === room.id
                        ? 'bg-destructive text-destructive-foreground'
                        : 'border border-destructive/30 text-destructive hover:bg-destructive/5'
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {confirmRemoveId === room.id ? 'Confirm' : 'Remove'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
