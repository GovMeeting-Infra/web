'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import type { Room, CreateRoomInput } from '@/lib/types/rooms';

const field =
  'mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none';
const label = 'block text-sm font-medium text-foreground/80';

/**
 * Add/edit form for a room. Shared so the two paths can't drift — edit is the
 * same fields pre-filled, minus the ministry, which can't move after creation.
 */
export function RoomForm({
  room,
  isSuperAdmin,
  onSubmit,
  onCancel,
}: {
  room?: Room;
  isSuperAdmin: boolean;
  onSubmit: (values: CreateRoomInput) => Promise<void>;
  onCancel: () => void;
}) {
  const isEdit = !!room;

  const [name, setName] = useState(room?.name ?? '');
  const [location, setLocation] = useState(room?.location ?? '');
  const [capacity, setCapacity] = useState(String(room?.capacity ?? ''));
  const [amenities, setAmenities] = useState((room?.amenities ?? []).join(', '));
  const [ministryId, setMinistryId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Reuses the picker list added for the event form rather than a twin endpoint.
  const { data: ministries } = useQuery({
    queryKey: ['ministry-options'],
    queryFn: () =>
      apiFetch<{ id: string; name: string; code?: string }[]>(
        '/api/v1/events/ministry-options',
      ),
    enabled: isSuperAdmin && !isEdit,
  });

  const handleSubmit = async () => {
    setError(null);

    if (!name.trim() || !location.trim()) {
      setError('Name and location are required.');
      return;
    }
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1) {
      setError('Capacity must be a whole number of at least 1.');
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        location: location.trim(),
        capacity: cap,
        amenities: amenities
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        ...(isSuperAdmin && !isEdit && ministryId ? { ministryId } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the room.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-[1.5rem] border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-semibold text-primary">
          {isEdit ? `Edit ${room.name}` : 'Add a room'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Conference Room B"
            className={field}
          />
        </div>

        <div>
          <label className={label}>Location *</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ministry HQ, 2nd Floor"
            className={field}
          />
        </div>

        <div>
          <label className={label}>Capacity *</label>
          <input
            type="number"
            min="1"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="25"
            className={field}
          />
        </div>

        {isSuperAdmin && !isEdit && (
          <div>
            <label className={label}>Ministry</label>
            <select
              value={ministryId}
              onChange={(e) => setMinistryId(e.target.value)}
              className={field}
            >
              <option value="">My own ministry</option>
              {ministries?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.code ? ` (${m.code})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <label className={label}>
            Amenities{' '}
            <span className="text-muted-foreground">(comma separated)</span>
          </label>
          <input
            value={amenities}
            onChange={(e) => setAmenities(e.target.value)}
            placeholder="Projector, Whiteboard, Video conferencing"
            className={field}
          />
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Add room'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border bg-muted/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
