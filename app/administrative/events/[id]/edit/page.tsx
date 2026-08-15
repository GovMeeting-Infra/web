'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Building2, Globe, Upload } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api/client';
import { uploadImage } from '@/lib/upload';
import { useCurrentUser } from '@/components/SessionProvider';
import type { EventDetail } from '@/lib/types/events';
import { PageContainer } from '@/components/ui/page-container';
import { FormSkeleton } from '@/components/ui/skeletons';

// Same styling constants as the create form.
const field =
  'mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none';
const dateField =
  'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-[#d7e5fb]';
const label = 'block text-sm font-medium text-foreground/80';
const dateLabel = 'block text-sm font-medium text-foreground mb-2';

const EVENT_TYPES = [
  'MEETING',
  'CONFERENCE',
  'APPOINTMENT',
  'TRAINING',
  'WORKSHOP',
  'LAUNCH',
  'OTHER',
] as const;

const EVENT_SCOPES = ['OFFICIAL', 'TEAM'] as const;
const EVENT_CLASSIFICATIONS = ['PUBLIC', 'RESTRICTED'] as const;

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/** datetime-local needs YYYY-MM-DDTHH:mm in local time, not a UTC ISO string. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const currentUser = useCurrentUser();

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

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
      e.target.value = '';
    }
  };

  const [isPublic, setIsPublic] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [venueName, setVenueName] = useState('');
  const [allowGuestCheckIn, setAllowGuestCheckIn] = useState(true);
  const [requireGeofence, setRequireGeofence] = useState(false);
  const [type, setType] = useState<string>('MEETING');
  const [scope, setScope] = useState('');
  const [classification, setClassification] = useState('');
  const [colorCategory, setColorCategory] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [bannerImage, setBannerImage] = useState('');

  const {
    data: event,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ['event', id],
    queryFn: () => apiFetch<EventDetail>(`/api/v1/events/${id}`),
  });

  // Seed once, so typing isn't overwritten by a background refetch.
  useEffect(() => {
    if (!event || seeded) return;
    setIsPublic(event.isPublic);
    setTitle(event.title);
    setDescription(event.description ?? '');
    setVenueName(event.venueName ?? '');
    setType(event.type);
    setScope(event.scope ?? '');
    setClassification(event.classification ?? '');
    setColorCategory(event.colorCategory ?? '');
    setStartAt(toLocalInput(event.startAt));
    setEndAt(toLocalInput(event.endAt));
    setContactEmail(event.contactEmail ?? '');
    setContactPhone(event.contactPhone ?? '');
    setExternalUrl(event.externalUrl ?? '');
    setBannerImage(event.bannerImage ?? '');
    setAllowGuestCheckIn(event.allowGuestCheckIn ?? true);
    setRequireGeofence(event.requireGeofence ?? false);
    setSeeded(true);
  }, [event, seeded]);

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

    setIsSubmitting(true);
    try {
      // Empty strings clear a field; undefined leaves it untouched. Sending ''
      // for an @IsEmail/@IsUrl field would fail validation, so omit instead.
      await apiFetch(`/api/v1/events/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          isPublic,
          type,
          scope: scope || undefined,
          classification: classification || undefined,
          colorCategory: colorCategory.trim() || undefined,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          venueName: venueName.trim() || undefined,
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          externalUrl: externalUrl.trim() || undefined,
          bannerImage: bannerImage.trim() || undefined,
          allowGuestCheckIn,
          requireGeofence,
        }),
      });

      router.push(`/administrative/events/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <FormSkeleton fields={7} label="Loading event" />
      </PageContainer>
    );
  }

  // Only a 404 means the event is gone; anything else is a failure to load it,
  // and saying "not found" for a 500 sends you looking for the wrong problem.
  if (!event) {
    const status = loadError instanceof ApiError ? loadError.status : null;
    return (
      <div className="p-6 text-center text-muted-foreground sm:p-8">
        {status === 404
          ? "This event doesn't exist. It may have been deleted."
          : `Couldn't load this event. ${
              loadError instanceof Error ? loadError.message : ''
            }`}
      </div>
    );
  }

  // Mirrors updateEvent on the server: organizer, co-organizer, or a
  // ministry-level admin within the same ministry.
  const canEdit =
    !!currentUser &&
    (currentUser.id === event.organizerId ||
      event.coOrganizers.some((c) => c.userId === currentUser.id) ||
      ['SUPER_ADMIN', 'MINISTER', 'MINISTRY_ADMIN'].includes(currentUser.systemRole));

  if (!canEdit) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">
          Only the organizer, a co-organizer or a ministry admin can edit this event.
        </p>
        <Link href={`/administrative/events/${id}`} className="mt-4 inline-block text-primary">
          Back to event
        </Link>
      </div>
    );
  }

  return (
    <PageContainer>
      <Link
        href={`/administrative/events/${id}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Event
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-primary">Edit Activity</h1>
      </div>

      <div className="space-y-5">
        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Session Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={field}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={label}>Location</label>
          <input
            type="text"
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            className={field}
          />
        </div>

        <div>
          <label className={label}>Category</label>
          <input
            type="text"
            value={colorCategory}
            onChange={(e) => setColorCategory(e.target.value)}
            placeholder="e.g., LAUNCH"
            className={field}
          />
        </div>

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

        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={requireGeofence}
              onChange={(e) => setRequireGeofence(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border"
            />
            <span>
              <span className="text-sm font-medium text-foreground">
                Require location verification
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Attendees must be within 100m of where you stand when you
                generate the QR code. Without this, a poor GPS signal at that
                moment produces a code anyone can use from anywhere.
              </span>
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Organizer&apos;s email</label>
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

          {uploadError && <p className="mt-2 text-xs text-destructive">{uploadError}</p>}

          <input
            type="url"
            value={bannerImage}
            onChange={(e) => setBannerImage(e.target.value)}
            placeholder="…or paste an image URL"
            className={field}
          />
          <p className="mt-1 text-xs text-muted-foreground">Max 5MB, PNG/JPG/WebP.</p>
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className={field}
            >
              <option value="">Not set</option>
              {EVENT_SCOPES.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Classification</label>
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              className={field}
            >
              <option value="">Not set</option>
              {EVENT_CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>
                  {titleCase(c)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </PageContainer>
  );
}
