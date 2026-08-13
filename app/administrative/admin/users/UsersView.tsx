'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  Search,
  Power,
  Mail,
  Pencil,
  ShieldAlert,
  Copy,
  Check,
  LogOut,
  UnlockKeyhole,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { TableSkeleton } from '@/components/ui/skeletons';
import { initialsOf, ROLE_LABELS } from '@/lib/types/account';
import type { SystemRole } from '@/lib/types/events';
import { PageContainer } from '@/components/ui/page-container';

const field =
  'mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none';
const label = 'block text-sm font-medium text-foreground/80';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  jobTitle: string | null;
  systemRole: SystemRole;
  ministryId: string | null;
  active: boolean;
  deletedAt: string | null;
  createdAt: string;
  /** Set after five failed sign-ins; null once it lapses or is cleared. */
  lockedUntil: string | null;
  /** Whether they have ever set a password. False means the invite is outstanding. */
  hasCredential: boolean;
  /** When that invitation lapses; null once accepted. */
  inviteExpiresAt: string | null;
}

/** A lockedUntil in the past has lapsed on its own and needs no action. */
function isLocked(u: AdminUser): boolean {
  return Boolean(u.lockedUntil && new Date(u.lockedUntil) > new Date());
}

/**
 * What the status column says, in precedence order.
 *
 * "Active" used to cover anyone not deactivated, so someone created a minute
 * ago read as active despite having no password and no way to sign in.
 * Deactivation still outranks the invitation state: it is the deliberate act,
 * and an administrator who turned someone off wants to see that.
 */
function statusOf(u: AdminUser): {
  label: string;
  className: string;
  title?: string;
} {
  if (u.deletedAt) {
    return {
      label: 'Erased',
      className: 'bg-muted text-muted-foreground',
    };
  }

  if (!u.active) {
    return {
      label: 'Inactive',
      className: 'bg-destructive/10 font-medium text-destructive',
    };
  }

  if (!u.hasCredential) {
    const expiry = u.inviteExpiresAt ? new Date(u.inviteExpiresAt) : null;

    if (expiry && expiry < new Date()) {
      // The one state that needs someone to act: the link no longer works, and
      // the re-send button on this row is the fix.
      return {
        label: 'Invitation expired',
        className: 'bg-[#fff8e5] font-medium text-[#8d6400]',
        title: `Invitation lapsed on ${expiry.toLocaleDateString()} — re-send it`,
      };
    }

    return {
      label: 'Invited',
      className: 'bg-muted font-medium text-muted-foreground',
      title: expiry
        ? `Waiting for them to set a password. Invitation valid until ${expiry.toLocaleDateString()}.`
        : 'Waiting for them to set a password.',
    };
  }

  return {
    label: 'Active',
    className: 'bg-[#edf8f1] font-medium text-ring',
  };
}

interface Invite {
  userId: string;
  email: string;
  link: string;
  expiresInDays: number;
  emailSent: boolean;
  /** Why the send failed, when it did. */
  emailError?: string | null;
}

export function UsersView({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const queryClient = useQueryClient();

  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [ministryFilter, setMinistryFilter] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    systemRole: 'STAFF',
    jobTitle: '',
    ministryId: '',
  });
  const [invite, setInvite] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [erasing, setErasing] = useState<AdminUser | null>(null);
  const [eraseConfirm, setEraseConfirm] = useState('');

  // A ministry admin must not be able to mint a peer above themselves; the
  // server enforces this too.
  const assignableRoles: SystemRole[] = isSuperAdmin
    ? ['MINISTER', 'MINISTRY_ADMIN', 'STAFF']
    : ['MINISTRY_ADMIN', 'STAFF'];

  const { data: users = [], isLoading, error: loadError } = useQuery({
    queryKey: ['admin-users', q, roleFilter, ministryFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (q.trim()) p.set('q', q.trim());
      if (roleFilter) p.set('role', roleFilter);
      if (ministryFilter) p.set('ministryId', ministryFilter);
      return apiFetch<AdminUser[]>(`/api/v1/admin/users?${p.toString()}`);
    },
  });

  const { data: ministries = [] } = useQuery({
    queryKey: ['ministry-options'],
    queryFn: () =>
      apiFetch<{ id: string; name: string }[]>('/api/v1/events/ministry-options'),
    enabled: isSuperAdmin,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setError(null);
    try {
      await fn();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : msg);
    }
  };

  /**
   * Re-issues the invitation, which also retries the email. Used by the banner
   * and by the per-row button. Re-issuing invalidates the previous link, so the
   * banner always shows the one that now works.
   */
  const resendInvite = async (userId: string) => {
    setError(null);
    setIsResending(true);
    try {
      setInvite(
        await apiFetch<Invite>(`/api/v1/admin/users/${userId}/invite`, {
          method: 'POST',
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not re-issue the invitation.',
      );
    } finally {
      setIsResending(false);
    }
  };

  const handleCreate = async () => {
    setError(null);
    if (!form.name.trim() || !form.email.trim()) {
      setError('Name and email are required.');
      return;
    }
    // A super admin belongs to no ministry, so there is no "my own ministry"
    // to fall back on. The API rejects this too; catching it here saves a
    // round trip and keeps the form filled in.
    // A super admin has no ministry of their own to fall back on, and every
    // creatable role belongs to one — SUPER_ADMIN is not among them.
    if (isSuperAdmin && !form.ministryId) {
      setError('Choose which ministry this user belongs to.');
      return;
    }
    setIsSaving(true);
    try {
      const created = await apiFetch<{ invite: Invite }>('/api/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          systemRole: form.systemRole,
          jobTitle: form.jobTitle.trim() || undefined,
          ...(isSuperAdmin && form.ministryId
            ? { ministryId: form.ministryId }
            : {}),
        }),
      });
      setInvite(created.invite);
      setForm({ name: '', email: '', systemRole: 'STAFF', jobTitle: '', ministryId: '' });
      setShowCreate(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the user.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Six controls per user, shared by the table and the cards below it, so the
   * two cannot drift apart. gap-2 rather than the table's gap-1: these are
   * finger targets on a phone.
   */
  const rowActions = (u: AdminUser) =>
    u.deletedAt ? null : (
      <div className="flex items-center gap-1 max-sm:gap-2">
        <button
          title={u.active ? `Deactivate ${u.name}` : `Reactivate ${u.name}`}
          onClick={() =>
            act(
              () =>
                apiFetch(`/api/v1/admin/users/${u.id}/active`, {
                  method: 'PATCH',
                  body: JSON.stringify({ active: !u.active }),
                }),
              'Could not change the status.',
            )
          }
          className="rounded-lg p-1.5 max-sm:p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Power className="h-4 w-4" />
        </button>
        <button
          title={`Edit ${u.name}`}
          onClick={() => setEditing(u)}
          className="rounded-lg p-1.5 max-sm:p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          title={`Re-send invitation to ${u.name}`}
          disabled={isResending}
          onClick={() => resendInvite(u.id)}
          className="rounded-lg p-1.5 max-sm:p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <Mail className="h-4 w-4" />
        </button>
        <button
          title={`Sign ${u.name} out on all devices`}
          onClick={() =>
            act(
              () =>
                apiFetch(
                  `/api/v1/admin/users/${u.id}/sessions`,
                  { method: 'DELETE' },
                ),
              'Could not sign them out.',
            )
          }
          className="rounded-lg p-1.5 max-sm:p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </button>
        {/* Only where there is a lock to release — an Unlock
            button on every row invites clicking it as a guess
            when someone cannot sign in for an unrelated reason. */}
        {isLocked(u) && (
          <button
            title={`Unlock ${u.name} — locked until ${new Date(u.lockedUntil!).toLocaleTimeString()}`}
            onClick={() =>
              act(
                () =>
                  apiFetch(
                    `/api/v1/admin/users/${u.id}/unlock`,
                    { method: 'POST' },
                  ),
                'Could not unlock the account.',
              )
            }
            className="rounded-lg p-1.5 max-sm:p-2.5 text-[#8d6400] hover:bg-[#8d6400]/10"
          >
            <UnlockKeyhole className="h-4 w-4" />
          </button>
        )}
        <button
          title={`Erase ${u.name}'s personal data`}
          onClick={() => {
            setErasing(u);
            setEraseConfirm('');
          }}
          className="rounded-lg p-1.5 max-sm:p-2.5 text-destructive hover:bg-destructive/10"
        >
          <ShieldAlert className="h-4 w-4" />
        </button>
      </div>
    );

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-ring">
            Platform administration
          </p>
          <h1 className="text-3xl font-bold text-primary">Users</h1>
          <p className="mt-2 text-muted-foreground">
            {isSuperAdmin
              ? 'Manage users across all ministries'
              : 'Manage users in your ministry'}
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreate((v) => !v);
            setInvite(null);
          }}
          className="flex items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_8px_16px_rgba(0,53,128,0.24)]"
        >
          <UserPlus className="h-4 w-4" /> Add User
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* The link is shown whether or not the email went, so an administrator
          can always hand it over in person. */}
      {invite && (
        <div
          className={
            invite.emailSent
              ? 'rounded-[1.5rem] border border-[#cfe5d7] bg-[#edf8f1] p-6'
              : 'rounded-[1.5rem] border border-[#fde8a6] bg-[#fff8e5] p-6'
          }
        >
          {/* break-words: the heading interpolates an email, which has no
              break opportunity and runs past a 240px card. The invite URL
              below already gets the same treatment. */}
          <h2
            className={
              invite.emailSent
                ? 'break-words font-semibold text-[#007236]'
                : 'break-words font-semibold text-[#8d6400]'
            }
          >
            {invite.emailSent
              ? `Invitation emailed to ${invite.email}`
              : `${invite.email} created — send them this link`}
          </h2>
          <p
            className={
              invite.emailSent
                ? 'mt-1 text-sm text-[#007236]/90'
                : 'mt-1 text-sm text-[#8d6400]/90'
            }
          >
            {invite.emailSent
              ? `They can set their own password from the link in that email, which expires in ${invite.expiresInDays} days. The same link is below if you would rather pass it on directly.`
              : `The invitation could not be emailed${invite.emailError ? ` (${invite.emailError})` : ''}. The account exists — share this link with them directly, or try sending again. It lets them set their own password and expires in ${invite.expiresInDays} days.`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code
              className={
                invite.emailSent
                  ? 'min-w-0 flex-1 truncate rounded-lg border border-[#cfe5d7] bg-white px-3 py-2 text-xs text-slate-700'
                  : 'min-w-0 flex-1 truncate rounded-lg border border-[#fde8a6] bg-white px-3 py-2 text-xs text-slate-700'
              }
            >
              {invite.link}
            </code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(invite.link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className={
                invite.emailSent
                  ? 'flex items-center gap-1.5 rounded-lg bg-[#007236] px-3 py-2 text-xs font-medium text-white'
                  : 'flex items-center gap-1.5 rounded-lg bg-[#8d6400] px-3 py-2 text-xs font-medium text-white'
              }
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {!invite.emailSent && (
              <button
                onClick={() => resendInvite(invite.userId)}
                disabled={isResending}
                className="flex items-center gap-1.5 rounded-lg border border-[#8d6400]/40 px-3 py-2 text-xs font-medium text-[#8d6400] transition-colors hover:bg-[#8d6400]/10 disabled:opacity-60"
              >
                <Mail className="h-3.5 w-3.5" />
                {isResending ? 'Sending…' : 'Try sending again'}
              </button>
            )}
          </div>
          {!invite.emailSent && (
            <p className="mt-3 text-xs text-[#8d6400]/80">
              Sending again issues a fresh link and invalidates the one above.
            </p>
          )}
        </div>
      )}

      {showCreate && (
        <div className="space-y-4 rounded-[1.5rem] border border-border bg-card p-6">
          <h2 className="font-semibold text-primary">Create new user</h2>
          <p className="text-sm text-muted-foreground">
            They&apos;re emailed a link to set their own password — you never
            handle it. The link is shown to you as well, so you can pass it on
            directly if the email does not reach them.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Full name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Aminata Kamara"
                className={field}
              />
            </div>
            <div>
              <label className={label}>Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="aminata@moh.gov.sl"
                className={field}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Must be a government email ending in .gov.sl
              </p>
            </div>
            <div>
              <label className={label}>System role *</label>
              <select
                value={form.systemRole}
                onChange={(e) => setForm({ ...form, systemRole: e.target.value })}
                className={field}
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Job title</label>
              <input
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                placeholder="e.g. Director"
                className={field}
              />
            </div>
            {isSuperAdmin && (
              <div className="sm:col-span-2">
                <label className={label}>Ministry *</label>
                <select
                  value={form.ministryId}
                  onChange={(e) => setForm({ ...form, ministryId: e.target.value })}
                  className={field}
                >
                  {/* No "my own ministry" option: a super admin does not have
                      one, and picking it produced a user with no ministry. */}
                  <option value="">Select a ministry…</option>
                  {ministries.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  The email above must be on this ministry&apos;s domain.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCreate}
              disabled={isSaving}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {isSaving ? 'Creating…' : 'Create user & send invite'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-md border border-border bg-muted/50 px-4 py-2 text-sm font-medium text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-xl border border-border bg-input py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
          className="min-w-0 max-w-full truncate rounded-xl border border-border bg-input px-3 py-2 text-sm sm:max-w-[14rem]"
        >
          <option value="">All roles</option>
          {assignableRoles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        {isSuperAdmin && (
          <select
            value={ministryFilter}
            onChange={(e) => setMinistryFilter(e.target.value)}
            aria-label="Filter by ministry"
            // A select sizes itself to its widest option, and ministry names
            // run long. As a flex item with the default min-width:auto it then
            // refused to shrink and pushed off the side of the screen.
            className="min-w-0 max-w-full truncate rounded-xl border border-border bg-input px-3 py-2 text-sm sm:max-w-[14rem]"
          >
            <option value="">All ministries</option>
            {ministries.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loadError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {loadError instanceof Error ? loadError.message : 'Failed to load users'}
        </div>
      )}

      {isLoading && (
        <TableSkeleton rows={8} columns={5} label="Loading users" />
      )}

      {!isLoading && users.length === 0 && (
        <div className="rounded-[1.5rem] border border-border bg-card p-12 text-center text-muted-foreground">
          No users found
        </div>
      )}

      {!isLoading && users.length > 0 && (
        // The radius sits on the outer element and the scroller inside it:
        // on one element the rounded corners clip the content as it scrolls.
        <div className="hidden overflow-hidden rounded-[1.5rem] border border-border bg-card sm:block">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Job title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr
                    key={u.id}
                    className={`border-b border-border ${i % 2 === 1 ? 'bg-muted/10' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
                          {initialsOf(u.name)}
                        </span>
                        {u.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.systemRole}
                        disabled={!!u.deletedAt}
                        onChange={(e) =>
                          act(
                            () =>
                              apiFetch(`/api/v1/admin/users/${u.id}/role`, {
                                method: 'PATCH',
                                body: JSON.stringify({ systemRole: e.target.value }),
                              }),
                            'Could not change the role.',
                          )
                        }
                        className="rounded-lg border border-border bg-input px-2 py-1 text-xs disabled:opacity-50"
                      >
                        {assignableRoles.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.jobTitle ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const status = statusOf(u);
                        return (
                          <span
                            title={status.title}
                            className={`rounded-full px-2 py-0.5 text-xs ${status.className}`}
                          >
                            {status.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {rowActions(u)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {!isLoading && users.length > 0 && (
        <ul className="space-y-3 sm:hidden">
          {users.map((u) => {
            const status = statusOf(u);
            return (
              <li
                key={u.id}
                className="space-y-3 rounded-[1.25rem] border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground">
                      {initialsOf(u.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">{u.name}</span>
                      <span className="block truncate text-xs font-normal text-muted-foreground">
                        {u.email}
                      </span>
                    </span>
                  </span>
                  <span
                    title={status.title}
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${status.className}`}
                  >
                    {status.label}
                  </span>
                </div>

                {u.jobTitle && (
                  <p className="text-sm text-muted-foreground">{u.jobTitle}</p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* text-base, not the table's text-xs: Safari zooms the whole
                      page when a control under 16px takes focus. */}
                  <select
                    value={u.systemRole}
                    disabled={!!u.deletedAt}
                    aria-label={`Role for ${u.name}`}
                    onChange={(e) =>
                      act(
                        () =>
                          apiFetch(`/api/v1/admin/users/${u.id}/role`, {
                            method: 'PATCH',
                            body: JSON.stringify({ systemRole: e.target.value }),
                          }),
                        'Could not change the role.',
                      )
                    }
                    className="rounded-lg border border-border bg-input px-2 py-1.5 text-base disabled:opacity-50"
                  >
                    {assignableRoles.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>

                  {rowActions(u)}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Edit dialog */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-[1.5rem] border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="break-all font-semibold text-primary">
              Edit {editing.email}
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className={label}>Full name</label>
                <input
                  defaultValue={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className={field}
                />
              </div>
              <div>
                <label className={label}>Job title</label>
                <input
                  defaultValue={editing.jobTitle ?? ''}
                  onChange={(e) =>
                    setEditing({ ...editing, jobTitle: e.target.value })
                  }
                  className={field}
                />
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={async () => {
                  await act(
                    () =>
                      apiFetch(`/api/v1/admin/users/${editing.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                          name: editing.name,
                          jobTitle: editing.jobTitle ?? '',
                        }),
                      }),
                    'Could not save.',
                  );
                  setEditing(null);
                }}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
              >
                Save
              </button>
              <button
                onClick={() => setEditing(null)}
                className="rounded-md border border-border bg-muted/50 px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Erase dialog — irreversible, so it demands the email be typed. */}
      {erasing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setErasing(null)}
        >
          <div
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-[1.5rem] border border-destructive/30 bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="flex items-center gap-2 font-semibold text-destructive">
              <ShieldAlert className="h-5 w-5" /> Erase personal data
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              This permanently replaces {erasing.name}&apos;s name and email with
              anonymous values and revokes their access. Their historical records
              stay, but they can never be identified or restored.{' '}
              <span className="font-medium text-foreground">
                This cannot be undone.
              </span>
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Type <span className="break-all font-mono text-foreground">{erasing.email}</span>{' '}
              to confirm:
            </p>
            <input
              value={eraseConfirm}
              onChange={(e) => setEraseConfirm(e.target.value)}
              className={field}
            />
            <div className="mt-5 flex gap-2">
              <button
                disabled={eraseConfirm !== erasing.email}
                onClick={async () => {
                  await act(
                    () =>
                      apiFetch(`/api/v1/admin/users/${erasing.id}`, {
                        method: 'DELETE',
                      }),
                    'Could not erase this user.',
                  );
                  setErasing(null);
                }}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-40"
              >
                Erase permanently
              </button>
              <button
                onClick={() => setErasing(null)}
                className="rounded-md border border-border bg-muted/50 px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
