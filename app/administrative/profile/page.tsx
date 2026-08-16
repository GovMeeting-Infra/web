'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Upload,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Phone,
  ShieldCheck,
  Monitor,
  Download,
  AlertCircle,
} from 'lucide-react';
import { apiFetch, apiDownload, messageFor } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeaderSkeleton, StatCardsSkeleton } from '@/components/ui/skeletons';
import { uploadImage } from '@/lib/upload';
import { PageContainer } from '@/components/ui/page-container';
import { PasswordInput } from '@/components/ui/password-input';
import { useUnsavedWarning } from '@/lib/hooks/useUnsavedWarning';
import {
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  initialsOf,
  type MyProfile,
  type UserPreferences,
} from '@/lib/types/account';

const field =
  'mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none';
const label = 'block text-sm font-medium text-foreground/80';
const hint = 'mt-1 text-xs text-muted-foreground';

/**
 * The four tints carry a `--stat-muted` custom property so the label can be a
 * dimmer colour at full opacity. The label was `opacity-80` over the card's own
 * colour, which put the green and gold pairs at 3.80:1 and 4.04:1 — under AA
 * for 12px text. The dashboard fixed this months ago; this page kept its own
 * copy of the component and kept the bug.
 */
const STAT_TINTS = {
  blue: 'border-stat-blue-border bg-stat-blue-bg text-stat-blue-fg [--stat-muted:var(--color-stat-blue-muted)]',
  green:
    'border-stat-green-border bg-stat-green-bg text-stat-green-fg [--stat-muted:var(--color-stat-green-muted)]',
  violet:
    'border-stat-violet-border bg-stat-violet-bg text-stat-violet-fg [--stat-muted:var(--color-stat-violet-muted)]',
  gold: 'border-stat-gold-border bg-stat-gold-bg text-stat-gold-fg [--stat-muted:var(--color-stat-gold-muted)]',
} as const;

function StatCard({
  label: text,
  value,
  icon,
  tint,
  href,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tint: keyof typeof STAT_TINTS;
  href: string;
}) {
  return (
    <Link
      href={href}
      // Linked, not decorative. A bare count on your own page that you cannot
      // open is a score someone else keeps about you; the same number you can
      // click through to check is transparency.
      className={`block rounded-[1.5rem] border p-5 transition-transform hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${STAT_TINTS[tint]}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--stat-muted)]">
          {text}
        </p>
        {icon}
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </Link>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-border bg-card p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-primary">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * A fact about the account that the person cannot change themselves, shown with
 * who to ask instead of being hidden.
 *
 * These three used to vanish entirely the moment you pressed Edit, which taught
 * people that the edit form was the whole inventory of their account — so
 * someone sitting in the wrong ministry had no way to learn it was a fixable
 * fact, let alone whose job it was.
 */
function AdministeredRow({
  term,
  value,
  note,
}: {
  term: string;
  value: React.ReactNode;
  note: string;
}) {
  return (
    <div className="border-t border-border py-3 first:border-t-0 first:pt-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {term}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-primary' : 'bg-border'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function AccountPage() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: profile, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MyProfile>('/api/v1/me'),
  });

  const { data: prefs } = useQuery({
    queryKey: ['my-preferences'],
    queryFn: () => apiFetch<UserPreferences>('/api/v1/me/preferences'),
  });

  return (
    <AccountView
      profile={profile}
      prefs={prefs}
      isLoading={isLoading}
      loadError={loadError}
      onRetry={() => refetch()}
      queryClient={queryClient}
      router={router}
    />
  );
}

function AccountView({
  profile,
  prefs,
  isLoading,
  loadError,
  onRetry,
  queryClient,
  router,
}: {
  profile?: MyProfile;
  prefs?: UserPreferences;
  isLoading: boolean;
  loadError: unknown;
  onRetry: () => void;
  queryClient: ReturnType<typeof useQueryClient>;
  router: ReturnType<typeof useRouter>;
}) {
  if (isLoading) {
    return (
      <PageContainer>
        <PageHeaderSkeleton />
        <Skeleton className="h-40 w-full rounded-[1.75rem]" />
        <StatCardsSkeleton />
      </PageContainer>
    );
  }

  if (loadError || !profile) {
    return (
      <PageContainer>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <p>{messageFor(loadError, "We couldn't load your account.")}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-destructive/10"
          >
            Try again
          </button>
        </div>
      </PageContainer>
    );
  }

  return (
    <AccountLoaded
      profile={profile}
      prefs={prefs}
      queryClient={queryClient}
      router={router}
    />
  );
}

function AccountLoaded({
  profile,
  prefs,
  queryClient,
  router,
}: {
  profile: MyProfile;
  prefs?: UserPreferences;
  queryClient: ReturnType<typeof useQueryClient>;
  router: ReturnType<typeof useRouter>;
}) {
  // ---- Your details -------------------------------------------------------
  const [name, setName] = useState(profile.name);
  const [jobTitle, setJobTitle] = useState(profile.jobTitle ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [image, setImage] = useState(profile.image ?? '');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsNotice, setDetailsNotice] = useState<string | null>(null);

  const detailsDirty =
    name !== profile.name ||
    jobTitle !== (profile.jobTitle ?? '') ||
    phone !== (profile.phone ?? '') ||
    image !== (profile.image ?? '');

  // ---- Password -----------------------------------------------------------
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwNotice, setPwNotice] = useState<string | null>(null);

  const pwDirty = Boolean(currentPassword || newPassword || confirmPassword);

  // ---- Display ------------------------------------------------------------
  const [compact, setCompact] = useState(prefs?.compactMode ?? false);
  const [displaySaving, setDisplaySaving] = useState(false);
  const [displayNotice, setDisplayNotice] = useState<string | null>(null);

  // ---- Your data ----------------------------------------------------------
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useUnsavedWarning(detailsDirty || pwDirty);

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      setImage(await uploadImage(file, 'avatars'));
    } catch (err) {
      setUploadError(
        messageFor(err, "That image didn't upload. Try again, or paste a link below."),
      );
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setDetailsError(null);
    setDetailsNotice(null);

    if (!name.trim()) {
      setDetailsError(
        'Enter your name. It appears on every attendance record you sign.',
      );
      return;
    }

    setDetailsSaving(true);
    try {
      await apiFetch('/api/v1/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          jobTitle: jobTitle.trim(),
          // Sent even when empty, because empty is how you clear a number.
          phone: phone.trim(),
          image: image.trim(),
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      // The sidebar avatar and user menu read the session, not this query, so
      // a new name or photo would otherwise not appear until a full reload.
      router.refresh();
      setDetailsNotice('Saved.');
    } catch (err) {
      setDetailsError(
        messageFor(
          err,
          "Your changes weren't saved. Check your connection and try again — nothing was lost.",
        ),
      );
    } finally {
      setDetailsSaving(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwNotice(null);

    if (newPassword.length < 8) {
      setPwError('Use at least 8 characters for your new password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("The two new passwords don't match.");
      return;
    }

    setPwSaving(true);
    try {
      const result = await apiFetch<{ otherSessionsSignedOut?: number }>(
        '/api/v1/me/password',
        {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword }),
        },
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      const others = result?.otherSessionsSignedOut ?? 0;
      setPwNotice(
        others > 0
          ? `Password changed. You have been signed out on ${others} other device${others === 1 ? '' : 's'}.`
          : 'Password changed. This was the only device you were signed in on.',
      );
    } catch (err) {
      setPwError(messageFor(err, "Your password wasn't changed. Try again."));
    } finally {
      setPwSaving(false);
    }
  };

  const saveDisplay = async (next: boolean) => {
    setCompact(next);
    setDisplaySaving(true);
    setDisplayNotice(null);
    try {
      await apiFetch('/api/v1/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ compactMode: next }),
      });
      queryClient.invalidateQueries({ queryKey: ['my-preferences'] });
      // Density is applied by the server-rendered shell.
      router.refresh();
      setDisplayNotice('Saved.');
    } catch {
      setCompact(!next);
      setDisplayNotice("That didn't save. Try again.");
    } finally {
      setDisplaySaving(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      // apiDownload rather than a bare fetch: it honours the filename the
      // server sends, and an elapsed session redirects to sign-in instead of
      // reporting a failed export.
      await apiDownload(
        '/api/v1/me/export',
        `my-account-${new Date().toISOString().slice(0, 10)}.json`,
      );
    } catch (err) {
      setExportError(messageFor(err, 'Could not prepare your data.'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PageContainer>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-success">
          {profile.ministry?.name ?? 'Government of Sierra Leone'}
        </p>
        <h1 className="text-3xl font-bold text-primary">Profile</h1>
        <p className="mt-2 text-muted-foreground">
          Your details, your password, and what this platform holds about you.
        </p>
      </div>

      {/* Identity card */}
      <div className="overflow-hidden rounded-[1.75rem] border border-border bg-primary text-primary-foreground">
        <div className="flex flex-wrap items-center gap-6 p-8 max-sm:p-4">
          {profile.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.image}
              alt=""
              className="h-24 w-24 shrink-0 rounded-full border-4 border-white/20 object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-white/20 bg-white/10 text-2xl font-bold"
            >
              {initialsOf(profile.name)}
            </span>
          )}

          <div className="min-w-0">
            <h2 className="text-2xl font-bold">{profile.name}</h2>
            {/* break-all, not break-words: a government address has no space
                or hyphen to break at, so at 320px it overflowed the card. */}
            <p className="mt-1 break-all text-primary-foreground/80">
              {profile.email}
            </p>
            {profile.phone && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-primary-foreground/80">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {profile.phone}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.jobTitle && (
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                  {profile.jobTitle}
                </span>
              )}
              {/* Visually distinct from the job title beside it. They used to
                  be identical chips 8px apart, which read as two of the same
                  thing — but one is free text and the other decides what you
                  can open. */}
              <span className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                {ROLE_LABELS[profile.systemRole]}
              </span>
            </div>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-4 rounded-[1.5rem] border border-border bg-card p-6 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Account created
          </dt>
          <dd className="mt-1 text-sm text-foreground">
            {formatDate(profile.createdAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Last signed in
          </dt>
          {/* Was "Last updated", bound to updatedAt — which the auth service
              bumps on every sign-in *and every failed sign-in*, so the figure
              moved when a stranger guessed your password. lastLoginAt was
              already being fetched and thrown away. */}
          <dd className="mt-1 text-sm text-foreground">
            {profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : 'Not yet'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </dt>
          <dd
            className={`mt-1 flex items-center gap-1.5 text-sm font-medium ${
              profile.active ? 'text-success' : 'text-destructive'
            }`}
          >
            {profile.active ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
            )}
            {profile.active ? 'Active' : 'Deactivated'}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Meetings you organised"
          value={profile.stats.organizedEvents}
          icon={<CalendarDays className="h-5 w-5 opacity-70" aria-hidden="true" />}
          tint="blue"
          // The events list has no "mine" filter to seed, so this opens the
          // list itself rather than carrying a query string that would be
          // silently ignored.
          href="/administrative/events"
        />
        <StatCard
          label="Meetings you attended"
          value={profile.stats.attendedEvents}
          icon={<CheckCircle2 className="h-5 w-5 opacity-70" aria-hidden="true" />}
          tint="green"
          href="/administrative/events"
        />
        <StatCard
          label="Open action items"
          value={profile.stats.actionItems}
          icon={<ClipboardList className="h-5 w-5 opacity-70" aria-hidden="true" />}
          tint="gold"
          href={`/administrative/action-items?owner=${encodeURIComponent(profile.id)}`}
        />
        <StatCard
          label="Coming up"
          value={profile.stats.upcomingEvents}
          icon={<Clock className="h-5 w-5 opacity-70" aria-hidden="true" />}
          tint="violet"
          href="/administrative/calendar"
        />
      </div>

      {/* ---- Your details --------------------------------------------- */}
      <Section
        icon={<CheckCircle2 className="h-5 w-5" />}
        title="Your details"
        description="What colleagues see, and how a meeting reaches you."
      >
        <form onSubmit={saveDetails} className="space-y-4">
          {detailsNotice && (
            <p
              role="status"
              aria-live="polite"
              className="rounded-lg border border-ring/20 bg-stat-green-bg p-3 text-sm text-success"
            >
              {detailsNotice}
            </p>
          )}
          {detailsError && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {detailsError}
            </p>
          )}

          <div>
            <label className={label} htmlFor="full-name">
              Full name
            </label>
            <input
              id="full-name"
              value={name}
              required
              aria-required="true"
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
              className={field}
            />
            <p className={hint}>
              This is what appears on the attendance records you sign.
            </p>
          </div>

          <div>
            <label className={label} htmlFor="job-title">
              Job title
            </label>
            <input
              id="job-title"
              value={jobTitle}
              autoComplete="organization-title"
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Director of Planning"
              className={field}
            />
            <p className={hint}>
              How you are described to colleagues. It does not change what you
              can open — that is your access level, below.
            </p>
          </div>

          <div>
            <label className={label} htmlFor="work-phone">
              Work phone
            </label>
            <input
              id="work-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+232 76 000000"
              className={field}
            />
            <p className={hint}>
              Optional. Recorded against your attendance when you check in, so an
              organiser can reach you about a meeting you were at. Visible to
              your ministry&rsquo;s admins and to organisers of meetings you
              attend. Leave it empty to remove it.
            </p>
          </div>

          <div>
            <p className={label}>Photo</p>
            {image.trim() && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={image}
                src={image}
                alt=""
                className="mb-3 mt-2 h-20 w-20 rounded-full border border-border object-cover"
                // keyed on the URL so a previously broken image is re-rendered
                // rather than staying hidden for the rest of the session.
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <input
              type="file"
              id="avatarFile"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarFile}
              className="peer sr-only"
            />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {/* The real input is sr-only and therefore focusable, but it is
                  clipped to 1px — so the focus ring landed somewhere invisible
                  and a keyboard user saw nothing. peer-focus-visible puts the
                  ring on the thing they can actually see. */}
              <label
                htmlFor="avatarFile"
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted/50 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                {isUploading ? 'Uploading…' : 'Upload a photo'}
              </label>
              {image.trim() && (
                <button
                  type="button"
                  onClick={() => setImage('')}
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-destructive"
                >
                  Remove
                </button>
              )}
            </div>
            {uploadError && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {uploadError}
              </p>
            )}
            <div className="mt-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="image-url">
                Or paste a link to an image
              </label>
              <input
                id="image-url"
                type="url"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://…"
                className={field}
              />
            </div>
            <p className={hint}>
              PNG, JPG or WebP, up to 5MB. Anyone in your ministry can see it.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={detailsSaving || !detailsDirty}
              className="flex items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {detailsSaving ? 'Saving…' : 'Save details'}
            </button>
            {detailsDirty && !detailsSaving && (
              <button
                type="button"
                onClick={() => {
                  setName(profile.name);
                  setJobTitle(profile.jobTitle ?? '');
                  setPhone(profile.phone ?? '');
                  setImage(profile.image ?? '');
                  setDetailsError(null);
                  setUploadError(null);
                }}
                className="rounded-[1.25rem] border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              >
                Discard changes
              </button>
            )}
          </div>
        </form>

        <dl className="mt-6 border-t border-border pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Set for you
          </p>
          <AdministeredRow
            term="Email address"
            value={<span className="break-all">{profile.email}</span>}
            note="Your sign-in address, and what places you in your ministry. Your ministry admin can change it."
          />
          <AdministeredRow
            term="Ministry"
            value={profile.ministry?.name ?? 'Not assigned'}
            note="Resolved from your email address. Ask your ministry admin if this is wrong."
          />
          <AdministeredRow
            term="Access level"
            value={ROLE_LABELS[profile.systemRole]}
            note={ROLE_DESCRIPTIONS[profile.systemRole]}
          />
        </dl>
      </Section>

      {/* ---- Password -------------------------------------------------- */}
      <Section
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Password"
        description="Changing it signs you out everywhere else."
      >
        <form onSubmit={savePassword} className="space-y-4">
          {pwNotice && (
            <p
              role="status"
              aria-live="polite"
              className="rounded-lg border border-ring/20 bg-stat-green-bg p-3 text-sm text-success"
            >
              {pwNotice}
            </p>
          )}
          {pwError && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {pwError}
            </p>
          )}

          <div>
            <label className={label} htmlFor="current-password">
              Current password
            </label>
            <PasswordInput
              id="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              wrapperClassName="mt-1"
              className={`${field} mt-0`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="new-password">
                New password
              </label>
              <PasswordInput
                id="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                wrapperClassName="mt-1"
                className={`${field} mt-0`}
              />
              <p className={hint}>
                At least 8 characters. A short phrase you will remember beats a
                short password you will not.
              </p>
            </div>
            <div>
              <label className={label} htmlFor="confirm-password">
                New password again
              </label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                wrapperClassName="mt-1"
                className={`${field} mt-0`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={pwSaving || !currentPassword || !newPassword}
            className="flex items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {pwSaving ? 'Changing…' : 'Change password'}
          </button>
        </form>
      </Section>

      {/* ---- Display --------------------------------------------------- */}
      <Section icon={<Monitor className="h-5 w-5" />} title="Display">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <label
              htmlFor="compact-mode"
              className="text-sm font-medium text-foreground"
            >
              Compact mode
            </label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tightens spacing across these pages, so more fits on screen.
            </p>
          </div>
          <Toggle
            id="compact-mode"
            checked={compact}
            onChange={saveDisplay}
            disabled={displaySaving || !prefs}
          />
        </div>
        {displayNotice && (
          <p role="status" aria-live="polite" className="mt-3 text-xs text-muted-foreground">
            {displayNotice}
          </p>
        )}
      </Section>

      {/* ---- Your data ------------------------------------------------- */}
      <Section
        icon={<Download className="h-5 w-5" />}
        title="Your data"
        description="Everything this platform holds about you."
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="min-w-0 text-sm text-muted-foreground">
            Your account, the meetings you organised or attended, your check-in
            records and your action items, as a JSON file.
          </p>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 rounded-[1.25rem] border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {isExporting ? 'Preparing…' : 'Download'}
          </button>
        </div>
        {exportError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {exportError}
          </p>
        )}
        <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
          Changes you make here are recorded in your ministry&rsquo;s activity
          log, which admins can read. Your phone number is recorded as changed
          without recording the number itself. To have your account erased, ask
          your ministry admin.
        </p>
      </Section>
    </PageContainer>
  );
}
