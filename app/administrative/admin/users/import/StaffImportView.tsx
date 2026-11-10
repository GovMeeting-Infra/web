'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, FileUp, RotateCcw } from 'lucide-react';
import { apiFetch, ApiError, messageFor } from '@/lib/api/client';
import { PageContainer } from '@/components/ui/page-container';

/** Mirrors MAX_CSV_BYTES on the server; checked here only to fail fast. */
const MAX_BYTES = 2 * 1024 * 1024;
/** Rows shown per list. The counts above are always the full numbers. */
const SHOWN = 100;

interface MinistryOption {
  id: string;
  name: string;
  emailDomain: string;
}

type SkipReason =
  | 'MISSING_NAME'
  | 'NAME_TOO_LONG'
  | 'INVALID_EMAIL'
  | 'WRONG_DOMAIN'
  | 'DUPLICATE_IN_FILE'
  | 'SUPPORT_ADDRESS'
  | 'HAS_ACCOUNT';

interface Person {
  line: number;
  firstName: string;
  lastName: string | null;
  email: string;
}

interface ImportResult {
  ministry: MinistryOption;
  filename: string;
  committed: boolean;
  totals: { rows: number; new: number; updated: number; unchanged: number; skipped: number };
  skippedByReason: Partial<Record<SkipReason, number>>;
  skipped: Array<{ line: number; name: string; email: string; reason: SkipReason }>;
  added?: Person[];
  updated?: Array<{
    line: number;
    email: string;
    from: { firstName: string; lastName: string | null };
    to: { firstName: string; lastName: string | null };
  }>;
}

const REASONS: Record<SkipReason, string> = {
  MISSING_NAME: 'No first name',
  NAME_TOO_LONG: 'Name longer than 100 characters',
  INVALID_EMAIL: 'Not a valid email address',
  WRONG_DOMAIN: "Not on the ministry's email domain",
  DUPLICATE_IN_FILE: 'Appears earlier in the file',
  SUPPORT_ADDRESS: 'The platform support mailbox, not a person',
  HAS_ACCOUNT: 'Already has an account, so already searchable',
};

const fullName = (p: { firstName: string; lastName: string | null }) =>
  [p.firstName, p.lastName].filter(Boolean).join(' ');

type Tab = 'added' | 'updated' | 'skipped';

/**
 * Upload a ministry's staff list to its roster, the no-account list that
 * the attendee search offers alongside people who have accounts.
 *
 * Two steps over the same bytes: the server previews the file, the uploader
 * reads what it will do, then confirms. The file is read once, so what is
 * confirmed is exactly what was previewed even if it changes on disk.
 */
export function StaffImportView({ isPlatformRole }: { isPlatformRole: boolean }) {
  const queryClient = useQueryClient();

  const { data: ministries = [], isLoading: ministriesLoading } = useQuery({
    queryKey: ['staff-import-ministries'],
    queryFn: () => apiFetch<MinistryOption[]>('/api/v1/admin/staff-directory/ministries'),
  });

  const [chosenId, setChosenId] = useState('');
  // A ministry role has exactly one option, its own.
  const ministryId = isPlatformRole ? chosenId : (ministries[0]?.id ?? '');
  const ministry = ministries.find((m) => m.id === ministryId);

  const [file, setFile] = useState<{ name: string; bytes: ArrayBuffer } | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('added');
  // Changing the <input>'s key clears its selection when starting over.
  const [inputKey, setInputKey] = useState(0);

  const send = (kind: 'preview' | 'import', id: string, f: { name: string; bytes: ArrayBuffer }) => {
    const params = new URLSearchParams({ filename: f.name });
    if (isPlatformRole) params.set('ministryId', id);
    return apiFetch<ImportResult>(`/api/v1/admin/staff-directory/${kind}?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: f.bytes,
    });
  };

  const runPreview = async (id: string, f: { name: string; bytes: ArrayBuffer }) => {
    setBusy('preview');
    setError(null);
    setPreview(null);
    try {
      const result = await send('preview', id, f);
      setPreview(result);
      setTab(result.totals.new > 0 ? 'added' : result.totals.updated > 0 ? 'updated' : 'skipped');
    } catch (e) {
      setError(messageFor(e, 'The file could not be checked. Try again.'));
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    setPreview(null);
    setDone(null);
    setError(null);
    if (!picked) {
      setFile(null);
      return;
    }
    if (picked.size > MAX_BYTES) {
      setFile(null);
      setError('The file is larger than 2 MB. Split it and upload each part.');
      return;
    }
    const next = { name: picked.name, bytes: await picked.arrayBuffer() };
    setFile(next);
    if (ministryId) await runPreview(ministryId, next);
  };

  const onMinistry = async (id: string) => {
    setChosenId(id);
    setPreview(null);
    setDone(null);
    setError(null);
    if (id && file) await runPreview(id, file);
  };

  const confirm = async () => {
    if (!file || !ministryId) return;
    setBusy('import');
    setError(null);
    try {
      const result = await send('import', ministryId, file);
      setDone(result);
      setPreview(null);
      // Pickers already open elsewhere in this tab should find the new people.
      await queryClient.invalidateQueries({ queryKey: ['person-picker'] });
    } catch (e) {
      const base = messageFor(e, 'The list could not be saved.');
      setError(
        e instanceof ApiError && e.status < 500
          ? base
          : `${base} It is safe to try again: uploading the same file twice adds nobody twice.`,
      );
    } finally {
      setBusy(null);
    }
  };

  const startOver = () => {
    setFile(null);
    setPreview(null);
    setDone(null);
    setError(null);
    setInputKey((k) => k + 1);
  };

  const writes = preview ? preview.totals.new + preview.totals.updated : 0;

  return (
    <PageContainer className="max-w-5xl">
      <div>
        <Link
          href="/administrative/admin/users"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Users
        </Link>
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em] text-success">
          {isPlatformRole ? 'Platform administration' : 'Your ministry'}
        </p>
        <h1 className="text-3xl font-bold text-primary">Upload a staff list</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Adds a ministry&apos;s staff to the list people search when they add meeting attendees.
          Nobody is given an account and nobody is emailed. Uploading again adds new people and
          corrects names; it never removes anyone.
        </p>
      </div>

      <section className="space-y-5 rounded-[1.5rem] border border-border bg-card p-4 sm:p-6">
        <div>
          <label htmlFor="ministry" className="block text-sm font-medium text-foreground/80">
            Ministry
          </label>
          {isPlatformRole ? (
            <select
              id="ministry"
              value={chosenId}
              onChange={(e) => onMinistry(e.target.value)}
              disabled={busy !== null || ministriesLoading}
              className="mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground focus:border-primary sm:max-w-md"
            >
              <option value="">{ministriesLoading ? 'Loading…' : 'Choose a ministry'}</option>
              {ministries.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : (
            <p id="ministry" className="mt-1 text-sm font-medium text-foreground">
              {ministriesLoading ? 'Loading…' : (ministry?.name ?? 'Your account belongs to no ministry.')}
            </p>
          )}
          {ministry && (
            <p className="mt-1 text-xs text-muted-foreground">
              Only addresses ending in <span className="font-medium">@{ministry.emailDomain}</span>{' '}
              are added.
            </p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-foreground/80">File</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A CSV whose first row is the headings <span className="font-medium">First name</span>,{' '}
            <span className="font-medium">Last name</span> and{' '}
            <span className="font-medium">Email</span>. Other columns are ignored. From Excel, use
            File → Save As → CSV.
          </p>
          <input
            key={inputKey}
            type="file"
            id="staffFile"
            accept=".csv,text/csv"
            onChange={onFile}
            // Not before the ministries arrive: a ministry role's target is
            // the first of them, and a file chosen sooner would never preview.
            disabled={busy !== null || ministriesLoading}
            className="peer sr-only"
          />
          <div className="mt-3 flex min-w-0 flex-wrap items-center gap-3">
            <label
              htmlFor="staffFile"
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted/50 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
            >
              <FileUp className="h-4 w-4" aria-hidden="true" />
              {file ? 'Choose a different file' : 'Choose a CSV file'}
            </label>
            {file && (
              <span className="min-w-0 max-w-full truncate text-sm text-muted-foreground">
                {file.name}
              </span>
            )}
          </div>
          {file && !ministryId && isPlatformRole && (
            <p className="mt-2 text-sm text-muted-foreground">Choose the ministry to check this file.</p>
          )}
        </div>
      </section>

      <div role="status" aria-live="polite">
        {busy === 'preview' && <p className="text-sm text-muted-foreground">Checking the file…</p>}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {preview && (
        <section className="space-y-5" aria-label="Preview">
          <Totals result={preview} />

          {writes === 0 ? (
            <p className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Nothing to add. Everyone in this file is already on the list or was skipped.
            </p>
          ) : (
            <div className="flex flex-col gap-3 rounded-[1.25rem] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-foreground">
                Nothing has been saved yet. Check the lists below, then confirm.
              </p>
              <button
                onClick={confirm}
                disabled={busy !== null}
                className="rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_8px_16px_rgba(0,53,128,0.24)] disabled:opacity-60"
              >
                {busy === 'import' ? 'Saving…' : confirmLabel(preview)}
              </button>
            </div>
          )}

          <Lists result={preview} tab={tab} onTab={setTab} />
        </section>
      )}

      {done && (
        <section
          className="space-y-5 rounded-[1.5rem] border border-stat-green-border bg-stat-green-bg p-4 sm:p-6"
          aria-label="Result"
        >
          <p className="flex items-center gap-2 font-semibold text-success">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            {done.ministry.name}: {done.totals.new} added, {done.totals.updated}{' '}
            {done.totals.updated === 1 ? 'name' : 'names'} updated.
          </p>
          <p className="text-sm text-foreground/80">
            They can now be found in the attendee search. {done.totals.unchanged} were already on the
            list{done.totals.skipped > 0 ? ` and ${done.totals.skipped} were skipped` : ''}.
          </p>
          {done.skipped.length > 0 && <Lists result={done} tab="skipped" onTab={() => {}} only />}
          <button
            onClick={startOver}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted/50"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Upload another file
          </button>
        </section>
      )}
    </PageContainer>
  );
}

function confirmLabel(r: ImportResult) {
  const parts = [];
  if (r.totals.new > 0) parts.push(`add ${r.totals.new} ${r.totals.new === 1 ? 'person' : 'people'}`);
  if (r.totals.updated > 0)
    parts.push(`update ${r.totals.updated} ${r.totals.updated === 1 ? 'name' : 'names'}`);
  const text = parts.join(' and ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function Totals({ result }: { result: ImportResult }) {
  const tiles = [
    { label: 'New', value: result.totals.new },
    { label: 'Name changes', value: result.totals.updated },
    { label: 'Already on the list', value: result.totals.unchanged },
    { label: 'Skipped', value: result.totals.skipped },
  ];
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{result.filename}</span> ·{' '}
        {result.totals.rows} {result.totals.rows === 1 ? 'row' : 'rows'} for {result.ministry.name}
      </p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-[1.25rem] border border-border bg-card p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.label}
            </dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums text-foreground">{t.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Lists({
  result,
  tab,
  onTab,
  only = false,
}: {
  result: ImportResult;
  tab: Tab;
  onTab: (t: Tab) => void;
  /** Show the one list without its tab bar. */
  only?: boolean;
}) {
  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: 'added', label: 'New', count: result.totals.new },
    { key: 'updated', label: 'Name changes', count: result.totals.updated },
    { key: 'skipped', label: 'Skipped', count: result.totals.skipped },
  ];

  const rows: Array<{ line: number; primary: string; secondary: string; note?: string }> =
    tab === 'added'
      ? (result.added ?? []).map((p) => ({ line: p.line, primary: fullName(p), secondary: p.email }))
      : tab === 'updated'
        ? (result.updated ?? []).map((u) => ({
            line: u.line,
            primary: fullName(u.to),
            secondary: u.email,
            note: `was ${fullName(u.from)}`,
          }))
        : result.skipped.map((s) => ({
            line: s.line,
            primary: s.name || '(no name)',
            secondary: s.email || '(no email)',
            note: REASONS[s.reason],
          }));

  return (
    <div className="space-y-3">
      {!only && (
        <div role="tablist" aria-label="Rows by outcome" className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => onTab(t.key)}
              className={`rounded-full border px-3 py-1.5 text-sm max-sm:py-2 ${
                tab === t.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-muted/50'
              }`}
            >
              {t.label} <span className="tabular-nums">({t.count})</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'skipped' && Object.keys(result.skippedByReason).length > 0 && (
        <ul className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {Object.entries(result.skippedByReason).map(([reason, n]) => (
            <li key={reason} className="rounded-full bg-muted px-2.5 py-1">
              {REASONS[reason as SkipReason]}: <span className="tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">None.</p>
      ) : (
        <ul
          role="list"
          className="divide-y divide-border overflow-hidden rounded-[1.25rem] border border-border bg-card"
        >
          {rows.slice(0, SHOWN).map((r) => (
            <li
              key={`${r.line}-${r.secondary}`}
              className="grid min-w-0 gap-x-4 gap-y-0.5 px-4 py-3 text-sm sm:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)]"
            >
              <span className="text-xs tabular-nums text-muted-foreground sm:text-sm">
                Line {r.line}
              </span>
              <span className="truncate font-medium text-foreground">{r.primary}</span>
              <span className="truncate text-muted-foreground">{r.secondary}</span>
              {/* Wraps rather than truncates: the reason is the point of the row. */}
              <span className="text-muted-foreground">{r.note ?? ''}</span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > SHOWN && (
        <p className="text-xs text-muted-foreground">
          Showing the first {SHOWN} of {rows.length}.
        </p>
      )}
    </div>
  );
}
