'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Pencil,
  X,
  Check,
  Upload,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeaderSkeleton, StatCardsSkeleton } from '@/components/ui/skeletons';
import { uploadImage } from '@/lib/upload';
import { PageContainer } from '@/components/ui/page-container';
import {
  ROLE_LABELS,
  initialsOf,
  type MyProfile,
} from '@/lib/types/account';

const field =
  'mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none';
const label = 'block text-sm font-medium text-foreground/80';

function StatCard({
  label: text,
  value,
  icon,
  tint,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <div className={`rounded-[1.5rem] border p-5 ${tint}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
          {text}
        </p>
        {icon}
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
    </div>
  );
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [image, setImage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const { data: profile, isLoading, error: loadError } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MyProfile>('/api/v1/me'),
  });

  const startEditing = () => {
    if (!profile) return;
    setName(profile.name);
    setJobTitle(profile.jobTitle ?? '');
    setImage(profile.image ?? '');
    setCurrentPassword('');
    setNewPassword('');
    setError(null);
    setNotice(null);
    setIsEditing(true);
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setIsUploading(true);
    try {
      setImage(await uploadImage(file, 'avatars'));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    setError(null);
    setNotice(null);

    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (newPassword && !currentPassword) {
      setError('Enter your current password to set a new one.');
      return;
    }

    setIsSaving(true);
    try {
      await apiFetch('/api/v1/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          jobTitle: jobTitle.trim() || undefined,
          image: image.trim() || undefined,
        }),
      });

      // Password is a separate call so a failed change doesn't silently
      // discard the profile edits that already succeeded.
      if (newPassword) {
        await apiFetch('/api/v1/me/password', {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword }),
        });
      }

      queryClient.invalidateQueries({ queryKey: ['me'] });
      setNotice(newPassword ? 'Profile and password updated.' : 'Profile updated.');
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

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
      <div className="p-8 text-center text-muted-foreground">
        {loadError instanceof Error ? loadError.message : 'Could not load your profile.'}
      </div>
    );
  }

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-ring">
            Personal account
          </p>
          <h1 className="text-3xl font-bold text-primary">Profile</h1>
          <p className="mt-2 text-muted-foreground">View and manage your account</p>
        </div>

        {!isEditing && (
          <button
            onClick={startEditing}
            className="flex items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_8px_16px_rgba(0,53,128,0.24)] transition-all hover:shadow-[0_12px_24px_rgba(0,53,128,0.32)]"
          >
            <Pencil className="h-4 w-4" /> Edit Profile
          </button>
        )}
      </div>

      {notice && (
        <div className="rounded-lg border border-ring/20 bg-[#edf8f1] p-4 text-sm text-ring">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!isEditing ? (
        <>
          <div className="overflow-hidden rounded-[1.75rem] border border-border bg-primary text-primary-foreground">
            <div className="flex flex-wrap items-center gap-6 p-8">
              {profile.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.image}
                  alt=""
                  className="h-24 w-24 shrink-0 rounded-full border-4 border-white/20 object-cover"
                />
              ) : (
                <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-white/20 bg-white/10 text-2xl font-bold">
                  {initialsOf(profile.name)}
                </span>
              )}

              <div className="min-w-0">
                <h2 className="text-2xl font-bold">{profile.name}</h2>
                <p className="mt-1 text-primary-foreground/80">{profile.email}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.jobTitle && (
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                      {profile.jobTitle}
                    </span>
                  )}
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                    {ROLE_LABELS[profile.systemRole]}
                  </span>
                  {profile.ministry && (
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                      {profile.ministry.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-4 rounded-[1.5rem] border border-border bg-card p-6 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Member since
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {new Date(profile.createdAt).toLocaleDateString(undefined, {
                  dateStyle: 'medium',
                })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Last updated
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {new Date(profile.updatedAt).toLocaleDateString(undefined, {
                  dateStyle: 'medium',
                })}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Account status
              </dt>
              <dd className="mt-1 text-sm font-medium text-ring">
                {profile.active ? 'Active' : 'Inactive'}
              </dd>
            </div>
          </dl>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Events Organized"
              value={profile.stats.organizedEvents}
              icon={<CalendarDays className="h-5 w-5 opacity-70" />}
              tint="border-[#c9d9f2] bg-[#edf3fd] text-[#003580]"
            />
            <StatCard
              label="Events Attended"
              value={profile.stats.attendedEvents}
              icon={<CheckCircle2 className="h-5 w-5 opacity-70" />}
              tint="border-[#cfe5d7] bg-[#edf8f1] text-[#007236]"
            />
            <StatCard
              label="Open Action Items"
              value={profile.stats.actionItems}
              icon={<ClipboardList className="h-5 w-5 opacity-70" />}
              tint="border-[#fde8a6] bg-[#fff8e5] text-[#8d6400]"
            />
            <StatCard
              label="Upcoming Events"
              value={profile.stats.upcomingEvents}
              icon={<Clock className="h-5 w-5 opacity-70" />}
              tint="border-[#d9cff2] bg-[#f3effd] text-[#4c1d95]"
            />
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <section className="space-y-4 rounded-[1.5rem] border border-border bg-card p-6">
            <h2 className="font-semibold text-primary">Profile</h2>

            <div>
              <label className={label}>Profile picture</label>
              {image.trim() && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image}
                  alt=""
                  className="mb-3 mt-2 h-20 w-20 rounded-full border border-border object-cover"
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
                className="sr-only"
              />
              <div className="mt-1 flex items-center gap-2">
                <label
                  htmlFor="avatarFile"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted/50"
                >
                  <Upload className="h-4 w-4" />
                  {isUploading ? 'Uploading…' : 'Upload Image'}
                </label>
                {image.trim() && (
                  <button
                    type="button"
                    onClick={() => setImage('')}
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
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="…or paste an image URL"
                className={field}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                PNG, JPG or WebP · Max 5MB
              </p>
            </div>

            <div>
              <label className={label}>Full name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={field}
              />
            </div>

            <div>
              <label className={label}>Job title</label>
              <input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Director of Planning"
                className={field}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-[1.5rem] border border-border bg-card p-6">
            <h2 className="font-semibold text-primary">Security</h2>
            <p className="text-sm text-muted-foreground">
              Leave blank to keep your current password.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Current password</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  className={field}
                />
              </div>
              <div>
                <label className={label}>New password</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className={field}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  At least 8 characters.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Show passwords
            </label>
          </section>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setError(null);
                setUploadError(null);
                setShowPasswords(false);
              }}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
