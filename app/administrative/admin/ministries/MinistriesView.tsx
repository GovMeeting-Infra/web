'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Power, Pencil, Copy, Check } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { TableSkeleton } from '@/components/ui/skeletons';
import { PageContainer } from '@/components/ui/page-container';

const field =
  'mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none';
const label = 'block text-sm font-medium text-foreground/80';

interface Ministry {
  id: string;
  name: string;
  code: string;
  emailDomain: string;
  active: boolean;
  _count?: { users: number; events: number };
}

interface Invite {
  email: string;
  link: string;
  expiresInDays: number;
  emailSent: boolean;
  emailError?: string | null;
}

const EMPTY_FORM = {
  name: '',
  code: '',
  emailDomain: '',
  adminName: '',
  adminEmail: '',
  adminJobTitle: '',
};

/** Mirrors GEOFENCE_RADIUS_METERS in the API's attendance/geofence.constants.ts. */
const CHECKIN_RADIUS_METERS = 100;

export function MinistriesView() {
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<Ministry | null>(null);
  const [toggling, setToggling] = useState<Ministry | null>(null);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    data: ministries = [],
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ['admin-ministries'],
    queryFn: () => apiFetch<Ministry[]>('/api/v1/admin/ministries'),
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['admin-ministries'] });

  const handleCreate = async () => {
    setError(null);
    if (!form.name.trim() || !form.code.trim() || !form.emailDomain.trim()) {
      setError('Name, code and email domain are required.');
      return;
    }
    // Either fill in the whole administrator section or leave it alone —
    // a half-filled one is a mistake, and the API would reject it anyway.
    const wantsAdmin = Boolean(
      form.adminName.trim() || form.adminEmail.trim() || form.adminJobTitle.trim(),
    );
    if (
      wantsAdmin &&
      !(form.adminName.trim() && form.adminEmail.trim() && form.adminJobTitle.trim())
    ) {
      setError(
        'To create the first administrator, give their name, email and job title.',
      );
      return;
    }

    setIsSaving(true);
    try {
      const created = await apiFetch<{ firstAdmin?: { invite: Invite } }>(
        '/api/v1/admin/ministries',
        {
          method: 'POST',
          body: JSON.stringify({
            name: form.name.trim(),
            code: form.code.trim().toUpperCase(),
            emailDomain: form.emailDomain.trim().toLowerCase(),
            ...(wantsAdmin
              ? {
                  firstAdmin: {
                    name: form.adminName.trim(),
                    email: form.adminEmail.trim().toLowerCase(),
                    jobTitle: form.adminJobTitle.trim(),
                  },
                }
              : {}),
          }),
        },
      );
      setInvite(created.firstAdmin?.invite ?? null);
      setForm(EMPTY_FORM);
      setShowCreate(false);
      refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not create the ministry.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id: string, body: Record<string, unknown>) => {
    setError(null);
    try {
      await apiFetch(`/api/v1/admin/ministries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update the ministry.',
      );
    }
  };

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-ring">
            Platform administration
          </p>
          <h1 className="text-3xl font-bold text-primary">Ministries</h1>
          <p className="mt-2 text-muted-foreground">
            Every ministry on the platform, and who can sign in to each
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreate((v) => !v);
            setInvite(null);
          }}
          className="flex items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_8px_16px_rgba(0,53,128,0.24)]"
        >
          <Plus className="h-4 w-4" /> Add Ministry
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Shown whether or not the email went out, so the administrator can be
          handed their link in person. Same behaviour as the users page. */}
      {invite && (
        <div
          className={
            invite.emailSent
              ? 'rounded-[1.5rem] border border-[#cfe5d7] bg-[#edf8f1] p-6'
              : 'rounded-[1.5rem] border border-[#fde8a6] bg-[#fff8e5] p-6'
          }
        >
          <h2
            className={
              invite.emailSent
                ? 'break-words font-semibold text-[#007236]'
                : 'break-words font-semibold text-[#8d6400]'
            }
          >
            {invite.emailSent
              ? `Ministry created — invitation emailed to ${invite.email}`
              : `Ministry created — send ${invite.email} this link`}
          </h2>
          <p
            className={
              invite.emailSent
                ? 'mt-1 text-sm text-[#007236]/90'
                : 'mt-1 text-sm text-[#8d6400]/90'
            }
          >
            {invite.emailSent
              ? `They set their own password from that link, which expires in ${invite.expiresInDays} days.`
              : `The invitation could not be emailed${invite.emailError ? ` (${invite.emailError})` : ''}. The account exists — share this link directly. It expires in ${invite.expiresInDays} days.`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-white px-3 py-2 text-xs text-slate-700">
              {invite.link}
            </code>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(invite.link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="space-y-4 rounded-[1.5rem] border border-border bg-card p-6">
          <h2 className="font-semibold text-primary">Create new ministry</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ministry of Health"
                className={field}
              />
            </div>
            <div>
              <label className={label}>Code *</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="MOH"
                className={field}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Short and unique. Stored uppercase.
              </p>
            </div>
            <div>
              <label className={label}>Email domain *</label>
              <input
                value={form.emailDomain}
                onChange={(e) => setForm({ ...form, emailDomain: e.target.value })}
                placeholder="moh.gov.sl"
                className={field}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Must end in .gov.sl. Only addresses on this domain can join the
                ministry.
              </p>
            </div>
          </div>

          {/* Not a setting. It reads as one of the fields above only because
              administrators reasonably ask how far away someone can check in
              from, and the answer should not require reading the source. */}
          <p className="text-xs text-muted-foreground">
            Check-in area: attendees must be within {CHECKIN_RADIUS_METERS} m of
            wherever the organiser generated the QR code. The same for every
            ministry, and not configurable here.
          </p>

          <div className="rounded-[1rem] border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold text-foreground">
              First administrator (optional)
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Without one, nobody can sign in to this ministry until you add a
              user separately. They are emailed a link to set their own
              password, and their address must be on the domain above.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={label}>Full name</label>
                <input
                  value={form.adminName}
                  onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                  placeholder="Aminata Kamara"
                  className={field}
                />
              </div>
              <div>
                <label className={label}>Email</label>
                <input
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                  placeholder="aminata@moh.gov.sl"
                  className={field}
                />
              </div>
              <div>
                <label className={label}>Job title</label>
                <input
                  value={form.adminJobTitle}
                  onChange={(e) =>
                    setForm({ ...form, adminJobTitle: e.target.value })
                  }
                  placeholder="Permanent Secretary"
                  className={field}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleCreate}
              disabled={isSaving}
              className="rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {isSaving ? 'Creating…' : 'Create ministry'}
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setForm(EMPTY_FORM);
                setError(null);
              }}
              className="rounded-[1.25rem] border border-border px-5 py-2.5 text-sm font-medium text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loadError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          Could not load ministries.
        </div>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : ministries.length === 0 ? (
        <div className="rounded-[1.5rem] border border-border bg-card p-12 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">No ministries yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add one to start inviting its staff.
          </p>
        </div>
      ) : (
        <div className="hidden overflow-hidden rounded-[1.5rem] border border-border bg-card sm:block">
          {/* The inner scroller is what makes the Actions column reachable on a
              narrow screen. Without it the card's overflow-hidden simply cut
              the table off, and min-w keeps w-full from squashing five columns
              into 375px instead of scrolling. Matches the activity log. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Ministry</th>
                  <th className="px-6 py-3 font-medium">Email domain</th>
                  <th className="px-6 py-3 font-medium">Users</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ministries.map((m) => (
                  <tr key={m.id} className={m.active ? '' : 'opacity-60'}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.code}</div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {m.emailDomain}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {m._count?.users ?? '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={
                          m.active
                            ? 'rounded-full bg-[#edf8f1] px-2.5 py-1 text-xs font-medium text-[#007236]'
                            : 'rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground'
                        }
                      >
                        {m.active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditing(m)}
                          title="Edit"
                          className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setToggling(m)}
                          title={m.active ? 'Deactivate' : 'Activate'}
                          className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && ministries.length > 0 && (
        <ul className="space-y-3 sm:hidden">
          {ministries.map((m) => (
            <li
              key={m.id}
              className={`space-y-3 rounded-[1.25rem] border border-border bg-card p-4 ${
                m.active ? '' : 'opacity-60'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.code}</p>
                </div>
                <span
                  className={
                    m.active
                      ? 'shrink-0 rounded-full bg-[#edf8f1] px-2.5 py-1 text-xs font-medium text-[#007236]'
                      : 'shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground'
                  }
                >
                  {m.active ? 'Active' : 'Deactivated'}
                </span>
              </div>

              <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <div className="flex gap-1.5">
                  <dt>Domain</dt>
                  <dd className="break-all text-foreground">{m.emailDomain}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>Users</dt>
                  <dd className="text-foreground">{m._count?.users ?? '—'}</dd>
                </div>
              </dl>

              {/* Full-width buttons rather than the table's icon pair: these
                  were the controls a phone could not reach at all. */}
              <div className="flex gap-2 border-t border-border pt-3">
                <button
                  onClick={() => setEditing(m)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" /> Edit
                </button>
                <button
                  onClick={() => setToggling(m)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Power className="h-4 w-4" />
                  {m.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-[1.5rem] border border-border bg-card p-6">
            <h2 className="font-semibold text-primary">Edit {editing.name}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Name</label>
                <input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className={field}
                />
              </div>
              <div>
                <label className={label}>Code</label>
                <input
                  value={editing.code}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                  className={field}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Email domain</label>
                <input
                  value={editing.emailDomain}
                  onChange={(e) =>
                    setEditing({ ...editing, emailDomain: e.target.value })
                  }
                  className={field}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={async () => {
                  await handleUpdate(editing.id, {
                    name: editing.name.trim(),
                    code: editing.code.trim().toUpperCase(),
                    emailDomain: editing.emailDomain.trim().toLowerCase(),
                  });
                  setEditing(null);
                }}
                className="rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Save changes
              </button>
              <button
                onClick={() => setEditing(null)}
                className="rounded-[1.25rem] border border-border px-5 py-2.5 text-sm font-medium text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivating signs out an entire ministry, so it is confirmed rather
          than done on a single click. */}
      {toggling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-[1.5rem] border border-border bg-card p-6">
            <h2 className="font-semibold text-primary">
              {toggling.active ? 'Deactivate' : 'Activate'} {toggling.name}?
            </h2>
            <p className="text-sm text-muted-foreground">
              {toggling.active
                ? `Its ${toggling._count?.users ?? 0} user${toggling._count?.users === 1 ? '' : 's'} will not be able to sign in. Events, minutes and audit records are kept, and reactivating restores access.`
                : 'Its users will be able to sign in again.'}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={async () => {
                  await handleUpdate(toggling.id, { active: !toggling.active });
                  setToggling(null);
                }}
                className={
                  toggling.active
                    ? 'rounded-[1.25rem] bg-destructive px-5 py-2.5 text-sm font-medium text-destructive-foreground'
                    : 'rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground'
                }
              >
                {toggling.active ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => setToggling(null)}
                className="rounded-[1.25rem] border border-border px-5 py-2.5 text-sm font-medium text-foreground"
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
