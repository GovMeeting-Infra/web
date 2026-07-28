'use client';

import { useState, useCallback, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, X, Building2, Globe, Upload } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api/client';
import { uploadImage } from '@/lib/upload';
import { useCurrentUser } from '@/components/SessionProvider';
import type {
  EventDetail,
  RoomSummary,
  CoOrganizerCandidate,
  Frequency,
  EndType,
} from '@/lib/types/events';

// Reference form styling (src/app/(app)/events/new/EventForm.tsx).
const field =
  'mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none';
const dateField =
  'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-[#d7e5fb]';
const label = 'block text-sm font-medium text-foreground/80';
const dateLabel = 'block text-sm font-medium text-foreground mb-2';

/** Internal sessions use a narrow set of types; public ones use a category. */
const SESSION_TYPES = [
  { value: 'MEETING', label: 'Meeting' },
  { value: 'CONFERENCE', label: 'Conference' },
  { value: 'APPOINTMENT', label: 'External Appointment' },
] as const;

const DEFAULT_CATEGORIES = [
  'CONFERENCE',
  'WORKSHOP',
  'TRAINING',
  'MEETING',
  'LAUNCH',
  'OTHER',
] as const;

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'WEEKDAYS', label: 'Every weekday' },
  { value: 'BIWEEKLY', label: 'Every two weeks' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'YEARLY', label: 'Yearly' },
];

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

type Invite = { name: string; email: string };

export default function NewEventPage() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const isSuperAdmin = currentUser?.systemRole === 'SUPER_ADMIN';

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isPublic, setIsPublic] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venueName, setVenueName] = useState('');
  const [allowGuestCheckIn, setAllowGuestCheckIn] = useState(true);
  const [roomId, setRoomId] = useState('');
  const [ministryId, setMinistryId] = useState('');
  const [type, setType] = useState<string>('MEETING');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');

  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [bannerImage, setBannerImage] = useState('');

  const [coOrganizers, setCoOrganizers] = useState<string[]>([]);
  const [invitedMinistries, setInvitedMinistries] = useState<string[]>([]);

  const [categoryInput, setCategoryInput] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');

  const [recurrenceFreq, setRecurrenceFreq] = useState('');
  const [recurrenceInterval, setRecurrenceInterval] = useState('1');
  const [recurrenceEndType, setRecurrenceEndType] = useState<EndType>('COUNT');
  const [recurrenceCount, setRecurrenceCount] = useState('4');
  const [recurrenceUntil, setRecurrenceUntil] = useState('');

  const { data: rooms } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => apiFetch<RoomSummary[]>('/api/v1/rooms'),
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ['co-organizer-candidates'],
    queryFn: () =>
      apiFetch<CoOrganizerCandidate[]>('/api/v1/events/co-organizer-candidates'),
  });

  // Picker-scoped list: /admin/ministries is admin-only, but any role creating
  // a public activity needs to choose invited ministries.
  const { data: ministries } = useQuery({
    queryKey: ['ministry-options'],
    queryFn: () =>
      apiFetch<{ id: string; name: string; code?: string }[]>(
        '/api/v1/events/ministry-options',
      ),
  });

  // The ministry hosting the activity — its own, or the one a super-admin filed
  // it under. It is never an "invited" ministry: it is the host, so offering it
  // in the invite list is offering to invite yourself.
  const hostMinistryId = isSuperAdmin
    ? ministryId || currentUser?.ministryId
    : currentUser?.ministryId;

  const invitableMinistries = (ministries ?? []).filter(
    (m) => m.id !== hostMinistryId,
  );

  const filteredCategories = DEFAULT_CATEGORIES.filter((c) =>
    c.toLowerCase().includes(categoryInput.toLowerCase()),
  );
  const showCustomCategory =
    !!categoryInput &&
    !DEFAULT_CATEGORIES.some((c) => c.toLowerCase() === categoryInput.toLowerCase());

  const handleBannerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    try {
      setBannerImage(await uploadImage(file, 'public-events'));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
      // Allow re-picking the same file after a failure.
      e.target.value = '';
    }
  };

  const addInvite = useCallback(() => {
    const email = inviteEmail.trim().toLowerCase();
    const name = inviteName.trim();
    setInviteError('');

    if (!email || !name) {
      setInviteError('Both name and email are required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError('Invalid email address');
      return;
    }
    if (invites.some((i) => i.email === email)) {
      setInviteError('This email is already invited');
      return;
    }

    setInvites((prev) => [...prev, { name, email }]);
    setInviteName('');
    setInviteEmail('');
  }, [inviteEmail, inviteName, invites]);

  const handleInviteKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addInvite();
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!startAt || !endAt) {
      setError('Start and end date/time are required.');
      return;
    }
    if (new Date(startAt) >= new Date(endAt)) {
      setError('Start time must be before end time.');
      return;
    }
    // Mirrors the server. Public activities are exempt — they have no organizer
    // to deputise for.
    if (!isPublic && coOrganizers.length === 0) {
      setError('Add at least one co-organizer.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        isPublic,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        coOrganizerIds: coOrganizers.length ? coOrganizers : undefined,
        ministryId: isSuperAdmin ? ministryId || undefined : undefined,
        allowGuestCheckIn,
      };

      if (isPublic) {
        payload.venueName = venueName.trim() || undefined;
        payload.colorCategory = selectedCategory || undefined;
        payload.bannerImage = bannerImage.trim() || undefined;
        payload.externalUrl = externalUrl.trim() || undefined;
        // Filtered again rather than trusting the chips: a super-admin can pick
        // a ministry, then change which ministry is hosting, leaving the host
        // sitting in its own invite list.
        const invited = invitedMinistries.filter((m) => m !== hostMinistryId);
        payload.invitedMinistryIds = invited.length ? invited : undefined;
      } else {
        payload.type = type;
        payload.roomId = roomId || undefined;
        payload.venueName = venueName.trim() || undefined;
        if (invites.length) {
          payload.inviteeExternals = invites;
        }
      }

      const event = await apiFetch<EventDetail>('/api/v1/events', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Recurrence is a second call: the series is built from a saved event.
      if (recurrenceFreq) {
        try {
          await apiFetch(`/api/v1/events/${event.id}/series`, {
            method: 'POST',
            body: JSON.stringify({
              frequency: recurrenceFreq,
              interval: Number(recurrenceInterval) || 1,
              endType: recurrenceEndType,
              count:
                recurrenceEndType === 'COUNT'
                  ? Number(recurrenceCount) || 2
                  : undefined,
              until:
                recurrenceEndType === 'UNTIL' && recurrenceUntil
                  ? new Date(recurrenceUntil).toISOString()
                  : undefined,
            }),
          });
        } catch (err) {
          // The event exists; say so rather than losing it behind an error.
          router.push(
            `/administrative/events/${event.id}?recurrenceError=${encodeURIComponent(
              err instanceof Error ? err.message : 'Recurrence failed',
            )}`,
          );
          return;
        }
      }

      router.push(`/administrative/events/${event.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Room is already booked for this time period.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to create event');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6 p-8">
      <Link
        href="/administrative/events"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Events
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-primary">Schedule Activity</h1>
        <p className="mt-2 text-muted-foreground">
          Create an internal meeting or a public activity
        </p>
      </div>

      <div className="space-y-5">
        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Activity Type Toggle */}
        <div>
          <label className={label}>Activity Type</label>
          <div className="mt-3 flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setIsPublic(false)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                !isPublic
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary/50'
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>Internal Activity</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPublic(true)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                isPublic
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-secondary/50'
              }`}
            >
              <Globe className="h-4 w-4" />
              <span>Public Activity</span>
            </button>
          </div>
        </div>

        <div>
          <label className={label}>Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={field}
          />
        </div>

        <div>
          <label className={label}>Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={field}
          />
        </div>

        {/* Location: free text for public, room picker for internal */}
        {isPublic ? (
          <div>
            <label className={label}>Location</label>
            <input
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="e.g., Main Conference Hall, National Stadium"
              className={field}
            />
          </div>
        ) : (
          <>
            <div>
              <label className={label}>Room</label>
              <select
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className={field}
              >
                <option value="">Select a room</option>
                {rooms?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.capacity} people) &mdash; {r.location}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={label}>Venue name (if off-site)</label>
              <input
                type="text"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                className={field}
              />
            </div>
          </>
        )}

        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={allowGuestCheckIn}
              onChange={(e) => setAllowGuestCheckIn(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border"
            />
            <span>
              <span className="text-sm font-medium text-foreground">
                Allow guest check-in
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                People without an account can check in with their name, email
                and signature.
              </span>
            </span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label}>Contact Email (optional)</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@example.com"
              className={field}
            />
          </div>
          <div>
            <label className={label}>Contact Phone (optional)</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+232 76 123 456"
              className={field}
            />
          </div>
        </div>

        {isSuperAdmin && (
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

        {/* Internal-only */}
        {!isPublic && (
          <>
            <div>
              <label className={label}>Session Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={field}
              >
                {SESSION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={label}>
                Co-organizers <span className="text-destructive">*</span>
              </label>

              {coOrganizers.length > 0 && (
                <div className="mb-3 mt-1 flex flex-wrap gap-2">
                  {coOrganizers.map((id) => {
                    const c = candidates.find((x) => x.id === id);
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
                      >
                        <span>{c?.name ?? c?.email ?? id}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setCoOrganizers(coOrganizers.filter((x) => x !== id))
                          }
                          className="ml-1 text-primary/60 transition-colors hover:text-primary"
                          aria-label="Remove co-organizer"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <select
                value=""
                onChange={(e) => {
                  const id = e.target.value;
                  if (id && !coOrganizers.includes(id)) {
                    setCoOrganizers([...coOrganizers, id]);
                  }
                  e.target.value = '';
                }}
                className={field}
              >
                <option value="">+ Add co-organizer</option>
                {candidates
                  .filter((c) => !coOrganizers.includes(c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name ?? c.email} ({c.email})
                    </option>
                  ))}
              </select>
              <p className="mt-0.5 text-xs text-muted-foreground">
                At least one is required. Co-organizers can edit this event and
                manage its attendees, so the meeting stays manageable when you
                are unavailable.
              </p>
            </div>
          </>
        )}

        {/* Public-only */}
        {isPublic && (
          <>
            <div>
              <label className={label}>Category</label>
              <div className="relative">
                <input
                  type="text"
                  value={categoryInput}
                  onChange={(e) => {
                    setCategoryInput(e.target.value);
                    setCategoryOpen(true);
                  }}
                  onFocus={() => setCategoryOpen(true)}
                  onBlur={() => setTimeout(() => setCategoryOpen(false), 150)}
                  placeholder="Select or type a category"
                  className={field}
                />
                {categoryOpen && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-border bg-card shadow-lg">
                    <div className="max-h-48 overflow-y-auto">
                      {filteredCategories.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(c);
                            setCategoryInput(titleCase(c));
                            setCategoryOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                        >
                          {titleCase(c)}
                        </button>
                      ))}
                      {showCustomCategory && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCategory(categoryInput.toUpperCase());
                            setCategoryOpen(false);
                          }}
                          className="w-full border-t border-border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50"
                        >
                          + Add &ldquo;{categoryInput}&rdquo; as custom category
                        </button>
                      )}
                      {filteredCategories.length === 0 && !showCustomCategory && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No categories match
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Start typing to search or create a custom category
              </p>
            </div>

            <div>
              <label className={label}>Banner Image</label>

              {bannerImage.trim() && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bannerImage}
                  alt="Banner preview"
                  className="mb-3 mt-1 h-40 w-full rounded-lg border border-border object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}

              <input
                type="file"
                id="bannerImageFile"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleBannerFile}
                className="sr-only"
              />
              <div className="mt-1 flex items-center gap-2">
                <label
                  htmlFor="bannerImageFile"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted/50"
                >
                  <Upload className="h-4 w-4" />
                  {isUploading ? 'Uploading…' : 'Choose Image'}
                </label>
                {bannerImage.trim() && (
                  <button
                    type="button"
                    onClick={() => setBannerImage('')}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Remove
                  </button>
                )}
              </div>

              {uploadError && (
                <p className="mt-2 text-xs text-destructive">{uploadError}</p>
              )}

              <input
                type="url"
                value={bannerImage}
                onChange={(e) => setBannerImage(e.target.value)}
                placeholder="…or paste an image URL"
                className={field}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Max 5MB, PNG/JPG/WebP.
              </p>
            </div>

            <div>
              <label className={label}>Invited Ministries</label>

              {invitedMinistries.length > 0 && (
                <div className="mb-3 mt-1 flex flex-wrap gap-2">
                  {invitedMinistries.map((mid) => {
                    const m = ministries?.find((x) => x.id === mid);
                    return (
                      <div
                        key={mid}
                        className="flex items-center gap-2 rounded-full bg-ring/10 px-3 py-1 text-sm text-ring"
                      >
                        <span>{m?.name ?? mid}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setInvitedMinistries(
                              invitedMinistries.filter((x) => x !== mid),
                            )
                          }
                          className="ml-1 text-ring/60 transition-colors hover:text-ring"
                          aria-label="Remove ministry"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <select
                value=""
                onChange={(e) => {
                  const mid = e.target.value;
                  if (mid && !invitedMinistries.includes(mid)) {
                    setInvitedMinistries([...invitedMinistries, mid]);
                  }
                  e.target.value = '';
                }}
                className={field}
              >
                <option value="">+ Add ministry</option>
                {invitableMinistries
                  .filter((m) => !invitedMinistries.includes(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.code ? ` (${m.code})` : ''}
                    </option>
                  ))}
              </select>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {ministries
                  ? 'Ministries invited to this activity.'
                  : 'Loading ministries…'}
              </p>
            </div>

            <div>
              <label className={label}>External URL (optional)</label>
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://example.com"
                className={field}
              />
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="startAt" className={dateLabel}>
              Start Date &amp; Time *
            </label>
            <input
              type="datetime-local"
              id="startAt"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className={dateField}
            />
          </div>
          <div>
            <label htmlFor="endAt" className={dateLabel}>
              End Date &amp; Time *
            </label>
            <input
              type="datetime-local"
              id="endAt"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className={dateField}
            />
          </div>
        </div>

        {/* Recurrence */}
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <h2 className="text-sm font-medium text-foreground">Repeat</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground/80">
                Frequency
              </label>
              <select
                value={recurrenceFreq}
                onChange={(e) => setRecurrenceFreq(e.target.value)}
                className={field}
              >
                <option value="">Does not repeat</option>
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {recurrenceFreq && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground/80">
                    Interval
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={recurrenceInterval}
                    onChange={(e) => setRecurrenceInterval(e.target.value)}
                    className={field}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground/80">
                    Ends
                  </label>
                  <select
                    value={recurrenceEndType}
                    onChange={(e) => setRecurrenceEndType(e.target.value as EndType)}
                    className={field}
                  >
                    <option value="COUNT">After N occurrences</option>
                    <option value="UNTIL">On a date</option>
                    <option value="NEVER">Never</option>
                  </select>
                </div>
                {recurrenceEndType === 'COUNT' && (
                  <div>
                    <label className="text-xs font-medium text-foreground/80">
                      Occurrences
                    </label>
                    <input
                      type="number"
                      min="2"
                      value={recurrenceCount}
                      onChange={(e) => setRecurrenceCount(e.target.value)}
                      className={field}
                    />
                  </div>
                )}
                {recurrenceEndType === 'UNTIL' && (
                  <div>
                    <label className="text-xs font-medium text-foreground/80">
                      Until
                    </label>
                    <input
                      type="date"
                      value={recurrenceUntil}
                      onChange={(e) => setRecurrenceUntil(e.target.value)}
                      className={field}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Invite attendees — internal only, mirroring the reference */}
        {!isPublic && (
          <div>
            <label className={label}>Invite attendees</label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Enter a name and email to add attendees. They receive an RSVP link.
            </p>

            {invites.length > 0 && (
              <div className="mt-3 space-y-2 rounded-lg border border-border/50 bg-muted/30 p-3">
                {invites.map((inv) => (
                  <div
                    key={inv.email}
                    className="flex items-center justify-between rounded-lg bg-card px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{inv.name}</p>
                      <p className="text-xs text-muted-foreground">{inv.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setInvites(invites.filter((i) => i.email !== inv.email))
                      }
                      className="ml-2 shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={`Remove ${inv.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <p className="pt-2 text-xs text-muted-foreground">
                  {invites.length} attendee{invites.length !== 1 ? 's' : ''} added
                </p>
              </div>
            )}

            <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3">
              {inviteError && (
                <div className="mb-2 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
                  {inviteError}
                </div>
              )}
              {/* Grid rather than flex: the shared `field` class already sets
                  w-full, so adding w-1/3 or flex-1 put two width utilities on
                  one element and overflowed the row. Grid cells size the
                  inputs, and minmax(0,…) stops them blowing out. */}
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_auto]">
                <div>
                  <label
                    htmlFor="inviteName"
                    className="text-xs font-medium text-foreground/80"
                  >
                    Full name
                  </label>
                  <input
                    id="inviteName"
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    onKeyDown={handleInviteKeyDown}
                    placeholder="Aminata Kamara"
                    className={field}
                  />
                </div>

                <div>
                  <label
                    htmlFor="inviteEmail"
                    className="text-xs font-medium text-foreground/80"
                  >
                    Email address
                  </label>
                  <input
                    id="inviteEmail"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={handleInviteKeyDown}
                    placeholder="aminata@moh.gov.sl"
                    className={field}
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={addInvite}
                    className="mt-1 w-full whitespace-nowrap rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 sm:w-auto"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          {isSubmitting ? 'Scheduling…' : 'Schedule activity'}
        </button>
      </div>
    </div>
  );
}
