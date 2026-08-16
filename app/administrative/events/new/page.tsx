'use client';

import { useState, useCallback, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, X, Building2, Globe, Upload } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import {
  useUnsavedWarning,
  confirmLeave,
} from '@/lib/hooks/useUnsavedWarning';
import { uploadImage } from '@/lib/upload';
import { useCurrentUser } from '@/components/SessionProvider';
import { PageContainer } from '@/components/ui/page-container';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  EventDetail,
  CoOrganizerCandidate,
  Frequency,
  EndType,
} from '@/lib/types/events';

// Reference form styling (src/app/(app)/events/new/EventForm.tsx).
const field =
  'mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none';
const dateField =
  'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-foreground';
const label = 'block text-sm font-medium text-foreground/80';
const dateLabel = 'block text-sm font-medium text-foreground mb-2';

/** Internal sessions use a narrow set of types; public ones use a category. */
const SESSION_TYPES = [
  { value: 'MEETING', label: 'Meeting' },
  { value: 'CONFERENCE', label: 'Conference' },
  { value: 'WORKSHOP', label: 'Workshop' },
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

/**
 * A landmark in a long form.
 *
 * This page asks for eighteen to twenty-one things under a single heading, in
 * one flat stack where every label is the same size — so there was no sense of
 * what belonged with what, or how much was left. The fields have not moved;
 * they are just grouped now, which is most of what was missing.
 */
function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border-t border-border pt-6 first:border-0 first:pt-0">
      <h2 className="font-semibold text-primary">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

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
  const [ministryId, setMinistryId] = useState('');
  const [type, setType] = useState<string>('MEETING');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');

  // Prepopulated with whoever is creating the activity — they are the contact
  // in almost every case, and the field is no longer optional. Seeded from the
  // session rather than left blank, but still editable: an activity is
  // sometimes organised on someone else's behalf.
  const [contactEmail, setContactEmail] = useState(currentUser?.email ?? '');
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

  /**
   * Co-organiser candidates. A failure here mattered more than most: at least
   * one co-organiser is mandatory, so an empty list is a hard block, and with
   * no error branch it read as "this ministry has no other staff" rather than
   * "the list did not load".
   */
  const { data: candidates = [], error: candidatesError } = useQuery({
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
    // The only way to say where a meeting is, since room booking was
    // withdrawn. Checked here as well as on the server so it reads as a
    // message next to the form rather than a rejected request.
    if (!venueName.trim()) {
      setError('A location is required.');
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
        payload.venueName = venueName.trim();
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
        payload.venueName = venueName.trim();
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
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Enough typed to be worth protecting. Anything the user actually authored
   * counts; the many fields that arrive with a default do not, or every visit
   * to this form would prompt on the way out.
   */
  const hasEnteredSomething =
    title.trim() !== '' ||
    description.trim() !== '' ||
    venueName.trim() !== '' ||
    startAt !== '' ||
    coOrganizers.length > 0;

  useUnsavedWarning(hasEnteredSomething && !isSubmitting);

  return (
    <PageContainer>
      <Link
        href="/administrative/events"
        onClick={(e) => {
          if (!confirmLeave(hasEnteredSomething)) e.preventDefault();
        }}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to events
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-primary">Schedule an activity</h1>
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
          <p className={label}>Activity Type</p>
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

        <SectionHeading
          title="About this activity"
          hint="What it is and where it is being held."
        />

        <div>
          <label className={label} htmlFor="title">Title *</label>
          <input id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={field}
          />
        </div>

        <div>
          <label className={label} htmlFor="description">Description</label>
          <textarea id="description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={field}
          />
        </div>

        {isPublic ? (
          <div>
            <label className={label} htmlFor="location">Location *</label>
            <input id="location"
              type="text"
              required
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="e.g., Main Conference Hall, National Stadium"
              className={field}
            />
          </div>
        ) : (
          <>
            <div>
              <label className={label} htmlFor="location-2">Location *</label>
              <input id="location-2"
                type="text"
                required
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="e.g., Committee Room 2, Ministry HQ"
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

        {/* Not a choice any more. Location verification always applies, so
            there is nothing to set here — but it does change what the organizer
            has to do on the day, and that is worth saying before they arrive
            rather than when a code is refused. */}
        <div className="rounded-xl border border-stat-blue-border bg-stat-blue-bg p-4">
          <p className="text-sm font-medium text-primary">
            Attendees must be within 100m to check in
          </p>
          <p className="mt-1 text-xs text-stat-blue-muted">
            Wherever you stand when you generate the QR code becomes the
            check-in area. Generate it in the room, on the day — a code cannot
            be created until your phone knows where you are. If the signal will
            not allow it, you can still record people at the desk from the
            attendees page.
          </p>
        </div>

        <SectionHeading
          title="Who to contact"
          hint="Shown to attendees so they can ask about the activity."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="organizers-email">Organizer&apos;s email</label>
            <input id="organizers-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@example.com"
              className={field}
            />
          </div>
          <div>
            <label className={label} htmlFor="contact-phone-optional">Contact Phone (optional)</label>
            <input id="contact-phone-optional"
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
            <label className={label} htmlFor="ministry">Ministry</label>
            <select id="ministry"
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
              <label className={label} htmlFor="session-type">Session Type</label>
              <select id="session-type"
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
                        // The last fallback is a raw cuid, which has no break
                        // opportunity at all — without max-w-full it grew the
                        // pill past the card and clipped the remove button.
                        className="flex max-w-full items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
                      >
                        <span className="truncate">
                          {c?.name ?? c?.email ?? id}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCoOrganizers(coOrganizers.filter((x) => x !== id))
                          }
                          className="ml-1 shrink-0 text-primary/60 transition-colors hover:text-primary"
                          aria-label="Remove co-organizer"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {candidatesError && (
                <p
                  role="alert"
                  className="mt-1 rounded-md border border-alert-border bg-alert-bg px-3 py-2 text-sm text-alert-fg"
                >
                  We could not load your colleagues. This is a connection
                  problem, not an empty ministry — reload the page before
                  filling this in.
                </p>
              )}

              <select
                value=""
                aria-label="Add a co-organizer"
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
              <p className={label}>Category</p>
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
              <p className={label}>Banner Image</p>

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
              <p className={label}>Invited Ministries</p>

              {invitedMinistries.length > 0 && (
                <div className="mb-3 mt-1 flex flex-wrap gap-2">
                  {invitedMinistries.map((mid) => {
                    const m = ministries?.find((x) => x.id === mid);
                    return (
                      <div
                        key={mid}
                        className="flex max-w-full items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-sm text-success"
                      >
                        <span className="truncate">{m?.name ?? mid}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setInvitedMinistries(
                              invitedMinistries.filter((x) => x !== mid),
                            )
                          }
                          className="ml-1 text-success/60 transition-colors hover:text-success"
                          aria-label="Remove ministry"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* A picker with nothing in it is not worth showing, and saying
                  "Loading ministries…" underneath it just puts the word
                  loading on screen. The field's own shape stands in until the
                  options exist. */}
              {!ministries ? (
                <div role="status" aria-live="polite">
                  <span className="sr-only">Loading ministries</span>
                  <Skeleton className="mt-1 h-10 w-full rounded-md" />
                  <Skeleton className="mt-2 h-3 w-56" />
                </div>
              ) : (
                <>
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
                    Ministries invited to this activity.
                  </p>
                </>
              )}
            </div>

            <div>
              <label className={label} htmlFor="external-url-optional">External URL (optional)</label>
              <input id="external-url-optional"
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://example.com"
                className={field}
              />
            </div>
          </>
        )}

        <SectionHeading
          title="When it happens"
          hint="A meeting can repeat; each occurrence is then managed on its own."
        />

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

        {/* Recurrence */}
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <h2 className="text-sm font-medium text-foreground">Repeat</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground/80" htmlFor="frequency">Frequency</label>
              <select id="frequency"
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-foreground/80" htmlFor="interval">Interval</label>
                  <input id="interval"
                    type="number"
                    min="1"
                    value={recurrenceInterval}
                    onChange={(e) => setRecurrenceInterval(e.target.value)}
                    className={field}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground/80" htmlFor="ends">Ends</label>
                  <select id="ends"
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
                    <label className="text-xs font-medium text-foreground/80" htmlFor="occurrences">Occurrences</label>
                    <input id="occurrences"
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
                    <label className="text-xs font-medium text-foreground/80" htmlFor="until">Until</label>
                    <input id="until"
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

        {!isPublic && (
          <SectionHeading
            title="Who is invited"
            hint="Everyone here gets an invitation with an RSVP link."
          />
        )}

        {/* Invite attendees — internal only, mirroring the reference */}
        {!isPublic && (
          <div>
            <p className={label}>Invite attendees</p>
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
    </PageContainer>
  );
}
