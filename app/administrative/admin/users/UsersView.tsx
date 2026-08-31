'use client';

import { useEffect, useRef, useState } from 'react';
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
  X,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { TableSkeleton } from '@/components/ui/skeletons';
import { initialsOf, ROLE_LABELS } from '@/lib/types/account';
import type { SystemRole } from '@/lib/types/events';
import { PageContainer } from '@/components/ui/page-container';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { Tooltip } from '@/components/ui/tooltip';
import { useTransientMessage } from '@/lib/hooks/useTransientMessage';
import { PersonPicker } from '@/components/ui/person-picker';

const field =
  'mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary';
const label = 'block text-sm font-medium text-foreground/80';

/**
 * What each role actually lets someone do, in the confirmation.
 *
 * "Promote to Ministry Admin" means nothing to an administrator who has not
 * memorised the permission matrix; naming the consequence is the whole point of
 * asking.
 */
const ROLE_GRANTS: Record<SystemRole, string> = {
  // Never rendered — the owner role is not assignable by anyone. Kept so the
  // map stays total against SystemRole rather than needing a cast.
  SUPER_ADMIN: 'They will be able to administer every ministry on the platform.',
  PLATFORM_ADMIN:
    "They'll be able to set up ministries and accounts across the platform, and see whether it is running. They won't be able to open anyone's meetings, minutes or attendance.",
  MINISTER:
    "They'll be able to manage everyone and everything in their ministry. A ministry has one minister, so the current one has to change first.",
  MINISTRY_ADMIN:
    "They'll be able to add and remove people in your ministry, and change its settings.",
  STAFF:
    "They'll be able to run meetings and take minutes. They won't be able to add or remove people.",
};

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
  /**
   * How many attendance records carry their signature. Erasing blanks all of
   * them, so the confirmation can say how much evidence is about to go.
   */
  _count?: { attendances: number };
}

/** A lockedUntil in the past has lapsed on its own and needs no action. */
function isLocked(u: AdminUser): boolean {
  return Boolean(u.lockedUntil && new Date(u.lockedUntil) > new Date());
}

/**
 * "Stops working on 23 August" rather than "expires in 7 days".
 *
 * A relative count is only usable at the moment it is read, and this banner is
 * routinely screenshotted or copied into a message that arrives later.
 */
function expiryDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
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
      // "Deactivated" is what the button that causes it says, and what the
      // ministries page calls the same state. "Inactive" also reads as
      // "hasn't signed in lately", which is a different thing entirely.
      label: 'Deactivated',
      className: 'bg-alert-bg font-medium text-alert-fg',
      title: 'They keep their records but cannot sign in.',
    };
  }

  // The state that generates the support calls, and it had no label at all —
  // it was inferable only from a sixth icon appearing in a row that already
  // had five. An administrator told "Aminata can't sign in" opened this page
  // and read "Active".
  if (isLocked(u)) {
    const until = new Date(u.lockedUntil!);
    return {
      label: 'Locked',
      className: 'bg-stat-gold-bg font-medium text-stat-gold-fg',
      title: `Locked after five failed sign-ins. Clears at ${until.toLocaleTimeString(
        undefined,
        { hour: '2-digit', minute: '2-digit' },
      )}, or unlock them now.`,
    };
  }

  if (!u.hasCredential) {
    const expiry = u.inviteExpiresAt ? new Date(u.inviteExpiresAt) : null;

    if (expiry && expiry < new Date()) {
      // The one state that needs someone to act: the link no longer works, and
      // the re-send button on this row is the fix.
      return {
        label: 'Invitation expired',
        className: 'bg-stat-gold-bg font-medium text-stat-gold-fg',
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
    className: 'bg-stat-green-bg font-medium text-success',
  };
}

/**
 * The Role cell.
 *
 * A select whose options came from `assignableRoles` rendered **blank** for
 * anyone holding a role the viewer cannot assign — and since a ministry has
 * exactly one minister, every ministry admin saw exactly one empty Role cell,
 * belonging to the most senior person in the building. Touching it offered to
 * demote them, and the server allowed it.
 *
 * Where the role cannot be assigned, it is now text: the fact is still shown,
 * the control simply is not offered.
 */
function RoleCell({
  user,
  assignableRoles,
  onChange,
  large = false,
}: {
  user: AdminUser;
  assignableRoles: SystemRole[];
  onChange: (next: SystemRole) => void;
  large?: boolean;
}) {
  if (!assignableRoles.includes(user.systemRole)) {
    return (
      <Tooltip
        content={`You cannot change a ${ROLE_LABELS[user.systemRole].toLowerCase()}'s role.`}
      >
        <span
          className={`inline-block rounded-lg border border-transparent px-2 py-1 font-medium text-foreground ${
            large ? 'text-base' : 'text-xs'
          }`}
        >
          {ROLE_LABELS[user.systemRole]}
        </span>
      </Tooltip>
    );
  }

  return (
    <select
      value={user.systemRole}
      disabled={!!user.deletedAt}
      aria-label={`Role for ${user.name}`}
      onChange={(e) => onChange(e.target.value as SystemRole)}
      className={`rounded-lg border border-border bg-input disabled:opacity-50 ${
        large ? 'px-2 py-1.5 text-base' : 'px-2 py-1 text-xs'
      }`}
    >
      {assignableRoles.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
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

export function UsersView({
  isPlatformRole,
  isOwner,
  currentUserId,
}: {
  /** Viewer belongs to no ministry, so the UI works across all of them. */
  isPlatformRole: boolean;
  /** Only the owner may appoint a platform admin. */
  isOwner: boolean;
  currentUserId: string;
}) {
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
  /** Focus target for the invite result, which can fire from far down the list. */
  const inviteRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Per-row. This was a single page-level boolean, so resending one person's
  // invitation disabled — and silenced the tooltip on — every other row's Mail
  // button at the same time.
  const [resendingId, setResendingId] = useState<string | null>(null);
  const isResending = resendingId !== null;
  const [error, setError] = useTransientMessage();
  const [isSaving, setIsSaving] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [erasing, setErasing] = useState<AdminUser | null>(null);
  const [eraseConfirm, setEraseConfirm] = useState('');
  /**
   * Promoting someone is the largest grant of power in this product, and it
   * used to happen on a bare select's onChange — a mis-click, or a scroll wheel
   * over a focused control, handed someone an entire ministry's user list.
   * Erasing a user, which the audit log fully records, already demanded a typed
   * email. The risk gradient was inverted.
   */
  const [roleChange, setRoleChange] = useState<{
    user: AdminUser;
    next: SystemRole;
  } | null>(null);

  /**
   * Deactivating and re-sending an invitation both reach into a colleague's
   * day — one signs them out of every device, the other silently kills a link
   * that may already be in their inbox. Both fired on a single unconfirmed tap
   * on a 36px glyph, which made them cheaper than opening the edit dialog to
   * fix a typo in a job title.
   */
  const [confirming, setConfirming] = useState<{
    user: AdminUser;
    kind: 'deactivate' | 'reactivate' | 'resend';
  } | null>(null);

  /** Case- and whitespace-insensitive, so a phone's autocapitalise can't block it. */
  const eraseMatches =
    !!erasing &&
    eraseConfirm.trim().toLowerCase() === erasing.email.trim().toLowerCase();

  // A ministry admin must not be able to mint a peer above themselves, and a
  // platform admin must not be able to mint another of itself. The server
  // enforces both; this only keeps the form from offering what it would refuse.
  const assignableRoles: SystemRole[] = isOwner
    ? ['PLATFORM_ADMIN', 'MINISTER', 'MINISTRY_ADMIN', 'STAFF']
    : isPlatformRole
      ? ['MINISTER', 'MINISTRY_ADMIN', 'STAFF']
      : ['MINISTRY_ADMIN', 'STAFF'];

  /**
   * The search term the query actually uses.
   *
   * `q` was in the key directly, so every keystroke was a new cache entry, a
   * new request for the whole ministry, and — because isLoading went true —
   * the table was replaced by an eight-row skeleton mid-word. Typing a name
   * made the list strobe.
   */
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  /**
   * Take the administrator to the link.
   *
   * The envelope on row 40 rendered its result at the top of the page, so the
   * observable effect of pressing it was nothing at all — and the reasonable
   * response to nothing is to press again, which issues a third link and kills
   * the second.
   */
  useEffect(() => {
    if (!invite) return;
    inviteRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    inviteRef.current?.focus({ preventScroll: true });
  }, [invite]);

  const {
    data: users = [],
    isLoading,
    isFetching,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey: ['admin-users', debouncedQ, roleFilter, ministryFilter],
    // Keeps the previous list on screen while the next one loads, so refining
    // a search updates in place instead of collapsing to a skeleton.
    placeholderData: (previous) => previous,
    queryFn: () => {
      const p = new URLSearchParams();
      if (debouncedQ) p.set('q', debouncedQ);
      if (roleFilter) p.set('role', roleFilter);
      if (ministryFilter) p.set('ministryId', ministryFilter);
      return apiFetch<AdminUser[]>(`/api/v1/admin/users?${p.toString()}`);
    },
  });

  const { data: ministries = [] } = useQuery({
    queryKey: ['ministry-options'],
    queryFn: () =>
      apiFetch<{ id: string; name: string }[]>('/api/v1/events/ministry-options'),
    enabled: isPlatformRole,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  /**
   * What just happened, for the live region below the header.
   *
   * Five of the six row actions changed nothing visible on success — signing
   * someone out on every device changed literally nothing on screen, so it was
   * indistinguishable from a dead button, and administrators pressed it again.
   * Nothing was announced to assistive tech either.
   */
  const [notice, setNotice] = useTransientMessage();
  /** Which row is mid-request, so its control can show it and not double-fire. */
  const [pending, setPending] = useState<string | null>(null);

  const act = async (
    fn: () => Promise<unknown>,
    msg: string,
    options: { done?: string; rowId?: string } = {},
  ) => {
    setError(null);
    setNotice(null);
    if (options.rowId) setPending(options.rowId);
    try {
      await fn();
      refresh();
      if (options.done) setNotice(options.done);
    } catch (err) {
      setError(err instanceof Error ? err.message : msg);
    } finally {
      setPending(null);
    }
  };

  /**
   * Re-issues the invitation, which also retries the email. Used by the banner
   * and by the per-row button. Re-issuing invalidates the previous link, so the
   * banner always shows the one that now works.
   */
  const resendInvite = async (userId: string) => {
    setError(null);
    setResendingId(userId);
    try {
      setInvite(
        await apiFetch<Invite>(`/api/v1/admin/users/${userId}/invite`, {
          method: 'POST',
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't send a new invitation. Try again, or copy the link from their row.",
      );
    } finally {
      setResendingId(null);
    }
  };

  const handleCreate = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError('Add their full name.');
      return;
    }
    if (!form.email.trim()) {
      setError('Add their email address.');
      return;
    }
    // Caught here rather than after a round trip. The server refuses anything
    // off the ministry's own domain, and that refusal arrived as a raw string
    // in a banner at the top of the page.
    if (!/^[^\s@]+@[^\s@]+\.gov\.sl$/i.test(form.email.trim())) {
      setError(
        'That address has to be a government one, ending in .gov.sl, on your ministry’s own domain.',
      );
      return;
    }
    // A super admin belongs to no ministry, so there is no "my own ministry"
    // to fall back on. The API rejects this too; catching it here saves a
    // round trip and keeps the form filled in.
    // A super admin has no ministry of their own to fall back on, and every
    // creatable role belongs to one — SUPER_ADMIN is not among them.
    if (isPlatformRole && !form.ministryId) {
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
          ...(isPlatformRole && form.ministryId
            ? { ministryId: form.ministryId }
            : {}),
        }),
      });
      setInvite(created.invite);
      setForm({ name: '', email: '', systemRole: 'STAFF', jobTitle: '', ministryId: '' });
      setShowCreate(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't set up the account. Check the email address and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Six controls per user, shared by the table and the cards below it, so the
   * two cannot drift apart. gap-2 rather than the table's gap-1: these are
   * finger targets on a phone.
   */
  const rowActions = (u: AdminUser) => {
    // Your own row keeps the harmless controls and loses the two that would
    // sign you out of the ministry you are administering. The server refuses
    // both as well; hiding a control is not a rule.
    const isSelf = u.id === currentUserId;

    return u.deletedAt ? null : (
      <div className="flex items-center gap-1 max-sm:gap-2">
        {!isSelf && (
        <Tooltip
          content={
            u.active
              ? `Deactivate ${u.name}. They keep their records but cannot sign in, and are signed out everywhere.`
              : `Let ${u.name} sign in again`
          }
        >
        <button
          aria-label={
            u.active
              ? `Deactivate ${u.name}, which signs them out and blocks sign-in`
              : `Let ${u.name} sign in again`
          }
          disabled={pending === u.id}
          onClick={() =>
            setConfirming({
              user: u,
              kind: u.active ? 'deactivate' : 'reactivate',
            })
          }
          className="rounded-lg p-1.5 max-sm:p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <Power className="h-4 w-4" />
        </button>
        </Tooltip>
        )}
        <Tooltip content={`Change ${u.name}'s name or job title`}>
        <button
          aria-label={`Edit ${u.name}`}
          onClick={() => setEditing(u)}
          className="rounded-lg p-1.5 max-sm:p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
        </Tooltip>
        <Tooltip
          content={`Send ${u.name} a fresh link to set their password. Any link they are already holding stops working.`}
        >
        <button
          aria-label={`Re-send invitation to ${u.name}, which stops their current link working`}
          disabled={resendingId === u.id}
          onClick={() => setConfirming({ user: u, kind: 'resend' })}
          className="rounded-lg p-1.5 max-sm:p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <Mail className="h-4 w-4" />
        </button>
        </Tooltip>
        <Tooltip
          content={`End every session ${u.name} has open, on every device. They can sign back in straight away.`}
        >
        <button
          aria-label={`Sign ${u.name} out on all devices`}
          disabled={pending === u.id}
          onClick={() =>
            act(
              () =>
                apiFetch(
                  `/api/v1/admin/users/${u.id}/sessions`,
                  { method: 'DELETE' },
                ),
              `Couldn't sign ${u.name} out. Try again.`,
              {
                rowId: u.id,
                done: `${u.name} has been signed out everywhere. They can sign back in.`,
              },
            )
          }
          className="rounded-lg p-1.5 max-sm:p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
        </button>
        </Tooltip>
        {/* Only where there is a lock to release — an Unlock
            button on every row invites clicking it as a guess
            when someone cannot sign in for an unrelated reason. */}
        {isLocked(u) && (
          <Tooltip
            content={`Locked after five failed sign-ins. Clears at ${new Date(
              u.lockedUntil!,
            ).toLocaleTimeString()}. Unlock to let them try now.`}
          >
          <button
            aria-label={`Unlock ${u.name}`}
            disabled={pending === u.id}
            onClick={() =>
              act(
                () =>
                  apiFetch(
                    `/api/v1/admin/users/${u.id}/unlock`,
                    { method: 'POST' },
                  ),
                `Couldn't unlock ${u.name}. The lock may have already lapsed — try refreshing.`,
                {
                  rowId: u.id,
                  done: `${u.name} can try signing in again now.`,
                },
              )
            }
            className="rounded-lg p-1.5 max-sm:p-2.5 text-stat-gold-fg hover:bg-stat-gold-fg/10 disabled:opacity-50"
          >
            <UnlockKeyhole className="h-4 w-4" />
          </button>
          </Tooltip>
        )}
        {/* Separated from the group. Erase sat immediately beside "sign out
            everywhere" — one reversible, one permanent, 8px apart, on a phone. */}
        {!isSelf && (
        <span className="ml-1 border-l border-border pl-1 max-sm:ml-2 max-sm:pl-2">
        <Tooltip
          content={`Permanently erase ${u.name}'s personal details, including the signature on every attendance record they signed. This cannot be undone.`}
        >
        <button
          aria-label={`Erase ${u.name} permanently`}
          onClick={() => {
            setErasing(u);
            setEraseConfirm('');
          }}
          className="rounded-lg p-1.5 max-sm:p-2.5 text-alert-fg hover:bg-alert-fg/10"
        >
          <ShieldAlert className="h-4 w-4" />
        </button>
        </Tooltip>
        </span>
        )}
      </div>
    );
  };

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-success">
            {isPlatformRole ? 'Platform administration' : 'Your ministry'}
          </p>
          <h1 className="text-3xl font-bold text-primary">Users</h1>
          {/* Says what the page holds, and how many. The count was nowhere on
              a page whose whole subject is a list — the ministries page shows
              a user count per row and this one couldn't answer it about
              itself. */}
          <p className="mt-2 text-muted-foreground">
            {isLoading
              ? 'Everyone who can sign in, and anyone still waiting on an invitation.'
              : `${users.length} ${users.length === 1 ? 'person' : 'people'} ${
                  isPlatformRole ? 'across all ministries' : 'in your ministry'
                }, including anyone still waiting on an invitation.`}
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreate((v) => !v);
            setInvite(null);
          }}
          className="flex items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_8px_16px_rgba(0,53,128,0.24)]"
        >
          <UserPlus className="h-4 w-4" /> Invite someone
        </button>
      </div>

      {/* Announced, and it sits under the header rather than only at the top
          of a scrolled page. Five row actions previously succeeded in total
          silence — sign-out-everywhere changed nothing on screen at all. */}
      <div role="status" aria-live="polite">
        {notice && (
          <div className="rounded-lg border border-stat-green-border bg-stat-green-bg p-3 text-sm text-success">
            {notice}
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {/* The link is shown whether or not the email went, so an administrator
          can always hand it over in person. */}
      {invite && (
        <div
          ref={inviteRef}
          tabIndex={-1}
          role="status"
          className={
            invite.emailSent
              ? 'relative rounded-[1.5rem] border border-stat-green-border bg-stat-green-bg p-6'
              : 'relative rounded-[1.5rem] border border-stat-gold-border bg-stat-gold-bg p-6'
          }
        >
          {/* Dismissible. It had no close control, so it stayed until the Add
              User toggle happened to clear it — through filter changes and
              refetches, still showing a link for whoever was invited last. */}
          <button
            type="button"
            onClick={() => setInvite(null)}
            aria-label="Dismiss"
            className="absolute right-4 top-4 rounded-lg p-1.5 text-current opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
          {/* break-words: the heading interpolates an email, which has no
              break opportunity and runs past a 240px card. The invite URL
              below already gets the same treatment. */}
          <h2
            className={
              invite.emailSent
                ? 'break-words font-semibold text-success'
                : 'break-words font-semibold text-stat-gold-fg'
            }
          >
            {invite.emailSent
              ? `Invitation emailed to ${invite.email}`
              : `They're set up, but we couldn't email ${invite.email}`}
          </h2>
          <p
            className={
              invite.emailSent
                ? 'mt-1 text-sm text-success/90'
                : 'mt-1 text-sm text-stat-gold-fg/90'
            }
          >
            {invite.emailSent
              ? `The link in that email lets them choose a password. It works once and stops working on ${expiryDate(invite.expiresInDays)}. Send it to them yourself as well if you like — it's the same link.`
              : `Send them this link however you normally reach them. It works once and stops working on ${expiryDate(invite.expiresInDays)}.${invite.emailError ? ` The email failed: ${invite.emailError}` : ''}`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code
              className={
                invite.emailSent
                  ? 'min-w-0 flex-1 truncate rounded-lg border border-stat-green-border bg-surface px-3 py-2 text-xs text-foreground'
                  : 'min-w-0 flex-1 truncate rounded-lg border border-stat-gold-border bg-surface px-3 py-2 text-xs text-foreground'
              }
            >
              {invite.link}
            </code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(invite.link);
                setCopied(true);
                if (copyTimer.current) clearTimeout(copyTimer.current);
                copyTimer.current = setTimeout(() => setCopied(false), 2000);
              }}
              className={
                invite.emailSent
                  ? 'flex items-center gap-1.5 rounded-lg bg-success px-3 py-2 text-xs font-medium text-white'
                  : 'flex items-center gap-1.5 rounded-lg bg-stat-gold-fg px-3 py-2 text-xs font-medium text-white'
              }
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {!invite.emailSent && (
              <button
                onClick={() => resendInvite(invite.userId)}
                disabled={isResending}
                className="flex items-center gap-1.5 rounded-lg border border-stat-gold-fg/40 px-3 py-2 text-xs font-medium text-stat-gold-fg transition-colors hover:bg-stat-gold-fg/10 disabled:opacity-60"
              >
                <Mail className="h-3.5 w-3.5" />
                {isResending ? 'Sending…' : 'Try sending again'}
              </button>
            )}
          </div>
          {!invite.emailSent && (
            <p className="mt-3 text-xs text-stat-gold-fg">
              Sending again makes a new link. The one above stops working.
            </p>
          )}
        </div>
      )}

      {showCreate && (
        // A real form: Enter now submits from any field. It was a div with a
        // bare onClick, so pressing Enter after typing a name did nothing.
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreate();
          }}
          className="space-y-4 rounded-[1.5rem] border border-border bg-card p-6"
        >
          <h2 className="font-semibold text-primary">Invite a colleague</h2>
          <p className="text-sm text-muted-foreground">
            We email them a link to choose their own password. You never see it,
            and you get a copy of the link in case the email doesn&apos;t
            arrive.
          </p>

          {/* Staff only. Somebody who already holds an account is not someone
              you can invite, so the roster endpoint drops them — which also
              means this list gets shorter every time you use it. The fields
              below stay editable: the roster is a convenience, not the only
              way to name a person. */}
          <div>
            <label className={label} htmlFor="staff-lookup">
              Find them on the staff list
            </label>
            <PersonPicker
              id="staff-lookup"
              value={null}
              onChange={(person) => {
                if (!person) return;
                setForm((prev) => ({
                  ...prev,
                  name: person.name,
                  email: person.email,
                }));
              }}
              placeholder="Search staff not yet on the platform…"
              endpoint="/api/v1/users/directory/people?sources=staff"
              allowUnassign={false}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Optional. Fills in the name and email below, both of which you can
              still change.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="full-name">Full name *</label>
              <input id="full-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Aminata Kamara"
                className={field}
              />
            </div>
            <div>
              <label className={label} htmlFor="email">Email *</label>
              <input id="email"
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
              <label className={label} htmlFor="system-role">Role *</label>
              <select id="system-role"
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
              <label className={label} htmlFor="job-title">Job title</label>
              <input id="job-title"
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                placeholder="Permanent Secretary"
                className={field}
              />
            </div>
            {isPlatformRole && (
              <div className="sm:col-span-2">
                <label className={label} htmlFor="ministry">Ministry *</label>
                <select id="ministry"
                  value={form.ministryId}
                  onChange={(e) => setForm({ ...form, ministryId: e.target.value })}
                  className={field}
                >
                  {/* No "my own ministry" option: a platform-wide viewer does not have
                      one, and picking it produced a user with no ministry. */}
                  <option value="">Select a ministry…</option>
                  {ministries.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Their email has to be on the domain of the ministry you pick.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {/* bg-primary, like every other primary action in the product.
                bg-foreground appeared on this button and nowhere else. */}
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {isSaving ? 'Sending…' : 'Send invitation'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-[1.25rem] border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="user-search"
            aria-label="Search users by name or email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-xl border border-border bg-input py-2 pl-9 pr-3 text-sm focus:border-primary"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
          className="min-w-0 max-w-full truncate rounded-xl border border-border bg-input px-3 py-2 text-sm sm:max-w-[14rem]"
        >
          <option value="">All roles</option>
          {/* Every role that can appear in the list, not only the ones this
              administrator may assign. Built from assignableRoles, a ministry
              admin could not filter for their own minister — the one person
              they can see and not change. */}
          {(['MINISTER', 'MINISTRY_ADMIN', 'STAFF'] as SystemRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        {isPlatformRole && (
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

      {/* The empty state below checks users.length === 0, and users defaults to
          [] — so a failed fetch used to render "No users yet · Add the first
          user" directly beneath this banner. */}
      {loadError && (
        <div
          role="alert"
          className="rounded-[1.5rem] border border-alert-border bg-alert-bg p-6 text-center"
        >
          <p className="font-medium text-alert-fg">
            We couldn&apos;t load the list.
          </p>
          <p className="mt-1 text-sm text-alert-fg/90">
            This is a connection problem, not an empty ministry. Nobody has been
            removed.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 rounded-full border border-alert-border bg-card px-4 py-2.5 text-sm font-medium text-alert-fg"
          >
            Try again
          </button>
        </div>
      )}

      {isLoading && (
        <TableSkeleton rows={8} columns={5} label="Loading users" />
      )}

      {!isLoading && !loadError && users.length === 0 && (
        <div className="rounded-[1.5rem] border border-border bg-card p-12 text-center">
          <p className="font-medium text-foreground">
            {q || roleFilter || ministryFilter
              ? `Nobody matches ${q.trim() ? `“${q.trim()}”` : 'those filters'}`
              : 'Nobody here yet'}
          </p>
          {/* The action was 400px above this and never referenced from it. */}
          {q || roleFilter || ministryFilter ? (
            <button
              type="button"
              onClick={() => {
                setQ('');
                setRoleFilter('');
                setMinistryFilter('');
              }}
              className="mt-4 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-muted"
            >
              Clear filters
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-4 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Invite your first colleague
            </button>
          )}
        </div>
      )}

      {/* The moment a new ministry admin actually meets, since they are always
          in their own list and so never see the empty state above. It is the
          most reasonable place in the product to explain how invitations work,
          and it explained nothing. */}
      {!isLoading && !loadError && users.length === 1 && !q && !roleFilter && (
        <div className="rounded-[1.5rem] border border-stat-blue-border bg-stat-blue-bg p-5">
          <p className="font-medium text-primary">
            It&apos;s just you here so far.
          </p>
          <p className="mt-1 text-sm text-stat-blue-muted">
            Invite the people who will run meetings and take minutes. Each one
            gets an email with a link to choose their own password — you never
            see it, and the link works once. Their address has to be on your
            ministry&apos;s domain.
          </p>
        </div>
      )}

      {!isLoading && !loadError && users.length > 0 && (
        // The radius sits on the outer element and the scroller inside it:
        // on one element the rounded corners clip the content as it scrolls.
        <div className="hidden overflow-hidden rounded-[1.5rem] border border-border bg-card sm:block">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Email</th>
                  <th scope="col" className="px-4 py-3">Role</th>
                  <th scope="col" className="px-4 py-3">Job title</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Actions</th>
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
                      <RoleCell
                        user={u}
                        assignableRoles={assignableRoles}
                        onChange={(next) => setRoleChange({ user: u, next })}
                      />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {u.jobTitle ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const status = statusOf(u);
                        return (
                          <Tooltip content={status.title} disabled={!status.title}>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </Tooltip>
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
        <ul role="list" className="space-y-3 sm:hidden">
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
                  <Tooltip content={status.title} disabled={!status.title}>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </Tooltip>
                </div>

                {u.jobTitle && (
                  <p className="text-sm text-muted-foreground">{u.jobTitle}</p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <RoleCell
                    user={u}
                    assignableRoles={assignableRoles}
                    onChange={(next) => setRoleChange({ user: u, next })}
                    // text-base, not the table's text-xs: Safari zooms the
                    // whole page when a control under 16px takes focus.
                    large
                  />

                  {rowActions(u)}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : 'Edit user'}
        className="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!editing) return;
                await act(
                  () =>
                    apiFetch(`/api/v1/admin/users/${editing.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({
                        name: editing.name,
                        jobTitle: editing.jobTitle ?? '',
                      }),
                    }),
                  "Couldn't save those changes. Try again.",
                );
                setEditing(null);
              }}
              className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Save
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="edit-user-name" className={label}>
              Full name
            </label>
            <input
              id="edit-user-name"
              value={editing?.name ?? ''}
              onChange={(e) =>
                editing && setEditing({ ...editing, name: e.target.value })
              }
              className={field}
            />
          </div>
          <div>
            <label htmlFor="edit-user-title" className={label}>
              Job title
            </label>
            <input
              id="edit-user-title"
              value={editing?.jobTitle ?? ''}
              onChange={(e) =>
                editing && setEditing({ ...editing, jobTitle: e.target.value })
              }
              className={field}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!roleChange}
        onClose={() => setRoleChange(null)}
        onConfirm={async () => {
          if (!roleChange) return;
          await act(
            () =>
              apiFetch(`/api/v1/admin/users/${roleChange.user.id}/role`, {
                method: 'PATCH',
                body: JSON.stringify({ systemRole: roleChange.next }),
              }),
            "Couldn't change their role. Nothing was changed — try again.",
          );
          setRoleChange(null);
        }}
        title={
          roleChange
            ? `Make ${roleChange.user.name} a ${ROLE_LABELS[roleChange.next]}?`
            : 'Change role?'
        }
        description={
          roleChange
            ? `${roleChange.user.name} is currently ${ROLE_LABELS[roleChange.user.systemRole]}. ${ROLE_GRANTS[roleChange.next]} The change takes effect the next time they sign in.`
            : ''
        }
        confirmLabel="Change role"
        busy={pending === roleChange?.user.id}
      />

      {/* Deactivate, reactivate and re-send an invitation. All three were a
          single unconfirmed tap; all three reach into someone else's day. */}
      <ConfirmDialog
        open={!!confirming}
        onClose={() => setConfirming(null)}
        onConfirm={async () => {
          if (!confirming) return;
          const { user: u, kind } = confirming;
          if (kind === 'resend') {
            setConfirming(null);
            await resendInvite(u.id);
            return;
          }
          const active = kind === 'reactivate';
          await act(
            () =>
              apiFetch(`/api/v1/admin/users/${u.id}/active`, {
                method: 'PATCH',
                body: JSON.stringify({ active }),
              }),
            `Couldn't ${kind} ${u.name}. Try again.`,
            {
              rowId: u.id,
              done: active
                ? `${u.name} can sign in again.`
                : `${u.name} has been deactivated and signed out everywhere.`,
            },
          );
          setConfirming(null);
        }}
        title={
          !confirming
            ? ''
            : confirming.kind === 'resend'
              ? `Send ${confirming.user.name} a new invitation?`
              : confirming.kind === 'reactivate'
                ? `Let ${confirming.user.name} sign in again?`
                : `Deactivate ${confirming.user.name}?`
        }
        description={
          !confirming
            ? ''
            : confirming.kind === 'resend'
              ? `They'll get a fresh link to choose a password. If they are already holding a link, it stops working — so only do this if the first one didn't reach them.`
              : confirming.kind === 'reactivate'
                ? `They'll be able to sign in again straight away, with the password they already had.`
                : `They'll be signed out on every device and won't be able to sign in. Their meetings, minutes and attendance records all stay. You can reverse this at any time.`
        }
        confirmLabel={
          !confirming
            ? 'Confirm'
            : confirming.kind === 'resend'
              ? 'Send a new link'
              : confirming.kind === 'reactivate'
                ? 'Let them sign in'
                : 'Deactivate'
        }
        destructive={confirming?.kind === 'deactivate'}
        busy={pending === confirming?.user.id || isResending}
      />

      {/* Erase dialog — irreversible, so it demands the email be typed.
          Previously a bare fixed div: no role, no focus move, no trap, no
          Escape and no restore, on the most destructive action in the product. */}
      <Modal
        open={!!erasing}
        onClose={() => setErasing(null)}
        title={erasing ? `Erase ${erasing.name} permanently` : 'Erase'}
        className="max-w-md border-alert-border"
        footer={
          <>
            <button
              type="button"
              onClick={() => setErasing(null)}
              className="rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!erasing || !eraseMatches || pending === erasing.id}
              onClick={async () => {
                if (!erasing) return;
                await act(
                  () =>
                    apiFetch(`/api/v1/admin/users/${erasing.id}`, {
                      method: 'DELETE',
                    }),
                  `Couldn't erase ${erasing.name}. Nothing was removed — try again.`,
                  {
                    rowId: erasing.id,
                    done: `${erasing.name} has been erased. Their records now show "Anonymous".`,
                  },
                );
                setErasing(null);
              }}
              className="rounded-full bg-alert-fg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Erase permanently
            </button>
          </>
        }
      >
        {/* The old copy said historical records stay and stopped there, which
            read as "nothing else is touched". Erasing also blanks the drawn
            signature and the GPS reading on every attendance record this person
            signed — on a product whose first principle is that the attendance
            record is the product, that is the sentence that was missing. */}
        <p className="text-sm text-muted-foreground">
          {erasing?.name}&apos;s name and email are replaced with
          &ldquo;Anonymous&rdquo;, and they can no longer sign in.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Their drawn signature and location are wiped from
          {erasing?._count
            ? ` all ${erasing._count.attendances} attendance ${
                erasing._count.attendances === 1 ? 'record' : 'records'
              } they signed`
            : ' every attendance record they signed'}
          . The record that they attended remains.{' '}
          <span className="font-medium text-foreground">
            This cannot be undone.
          </span>
        </p>
        <label
          htmlFor="erase-confirm"
          className="mt-4 block text-sm text-muted-foreground"
        >
          Type{' '}
          <span className="font-mono break-all text-foreground">
            {erasing?.email}
          </span>{' '}
          below. Erase stays disabled until it matches.
        </label>
        <input
          id="erase-confirm"
          value={eraseConfirm}
          onChange={(e) => setEraseConfirm(e.target.value)}
          // iOS capitalises the first letter of a text field by default, so a
          // strict comparison against a lowercased address could never match
          // and the button never enabled, with nothing explaining why.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="email"
          className={field}
        />
      </Modal>
    </PageContainer>
  );
}
