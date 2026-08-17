'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldAlert, Clock, AtSign } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { PageContainer } from '@/components/ui/page-container';
import { useTransientMessage } from '@/lib/hooks/useTransientMessage';

const field =
  'mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none';
const label = 'block text-sm font-medium text-foreground/80';

interface Setting {
  key: string;
  value: string;
  describe: string;
  /** Whether this is a stored override, the deployed env value, or the built-in default. */
  source: 'database' | 'environment' | 'default';
}

const SOURCE_LABEL: Record<Setting['source'], string> = {
  database: 'Changed here',
  environment: 'From the server environment',
  default: 'Built-in default',
};

/** Seconds → a phrase an administrator can sanity-check at a glance. */
function humanDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h && m) return `${h} hour${h === 1 ? '' : 's'} ${m} min`;
  if (h) return `${h} hour${h === 1 ? '' : 's'}`;
  return `${m} min`;
}

export function PlatformSettingsView() {
  const queryClient = useQueryClient();

  // null means "not edited yet", so the field shows whatever the server holds
  // and follows it after a save. Seeding state from the query in an effect
  // would fight the fetch and re-render for nothing.
  const [timeoutEdit, setTimeoutEdit] = useState<string | null>(null);
  const [domainEdit, setDomainEdit] = useState<string | null>(null);
  const [domainConfirm, setDomainConfirm] = useState('');
  const [error, setError] = useTransientMessage();
  const [saved, setSaved] = useTransientMessage();
  const [isSaving, setIsSaving] = useState(false);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => apiFetch<Setting[]>('/api/v1/admin/settings'),
  });

  const find = (key: string) => settings.find((s) => s.key === key);
  const timeoutSetting = find('SESSION_TIMEOUT_SECONDS');
  const domainSetting = find('GOVERNMENT_EMAIL_DOMAIN');

  const timeout_ = timeoutEdit ?? timeoutSetting?.value ?? '';
  const domain = domainEdit ?? domainSetting?.value ?? '';

  const domainChanged = Boolean(
    domainSetting && domain.trim() && domain.trim() !== domainSetting.value,
  );

  const save = async (body: Record<string, unknown>, what: string) => {
    setError(null);
    setSaved(null);
    setIsSaving(true);
    try {
      await apiFetch('/api/v1/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setSaved(what);
      setTimeoutEdit(null);
      setDomainEdit(null);
      setDomainConfirm('');
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not save ${what}.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer className="max-w-3xl">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-success">
          Platform administration
        </p>
        <h1 className="text-3xl font-bold text-primary">Platform settings</h1>
        <p className="mt-2 text-muted-foreground">
          Applies to every ministry. Takes effect within a minute, without a
          redeploy.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-lg border border-stat-green-border bg-stat-green-bg p-4 text-sm text-success">
          Saved {saved}.
        </div>
      )}

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-[1.5rem] bg-muted" />
      ) : (
        <>
          <section className="space-y-4 rounded-[1.5rem] border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              <Clock className="mt-1 h-5 w-5 text-muted-foreground" />
              <div>
                <h2 className="font-semibold text-primary">Session timeout</h2>
                <p className="text-sm text-muted-foreground">
                  How long someone stays signed in without activity. The clock
                  restarts each time they do something, so this is idle time,
                  not total time.
                </p>
              </div>
            </div>

            <div className="max-w-xs">
              <label className={label} htmlFor="seconds">Seconds</label>
              <input id="seconds"
                type="number"
                min={300}
                max={604800}
                value={timeout_}
                onChange={(e) => setTimeoutEdit(e.target.value)}
                className={field}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {humanDuration(Number(timeout_))} ·{' '}
                {timeoutSetting ? SOURCE_LABEL[timeoutSetting.source] : ''}
              </p>
            </div>

            <button
              onClick={() =>
                save(
                  { SESSION_TIMEOUT_SECONDS: Number(timeout_) },
                  'the session timeout',
                )
              }
              disabled={isSaving || !timeout_}
              className="rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              Save timeout
            </button>
          </section>

          <section className="space-y-4 rounded-[1.5rem] border border-border bg-card p-6">
            <div className="flex items-start gap-3">
              <AtSign className="mt-1 h-5 w-5 text-muted-foreground" />
              <div>
                <h2 className="font-semibold text-primary">
                  Government email domain
                </h2>
                <p className="text-sm text-muted-foreground">
                  Only addresses ending in this suffix can sign in. Ministry
                  domains sit underneath it — moh.gov.sl is covered by .gov.sl.
                </p>
              </div>
            </div>

            <div className="max-w-xs">
              <label className={label} htmlFor="suffix">Suffix</label>
              <input id="suffix"
                value={domain}
                onChange={(e) => setDomainEdit(e.target.value)}
                placeholder=".gov.sl"
                className={field}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {domainSetting ? SOURCE_LABEL[domainSetting.source] : ''}
              </p>
            </div>

            {/* Typed confirmation, like the anonymise flow: getting this wrong
                locks out everyone whose address no longer matches, including
                the person making the change. */}
            {domainChanged && (
              <div className="space-y-3 rounded-[1rem] border border-stat-gold-border bg-stat-gold-bg p-4">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-stat-gold-fg" />
                  <p className="text-sm text-stat-gold-fg">
                    Everyone whose email does not end in{' '}
                    <strong>{domain.trim()}</strong> will be unable to sign in,
                    including you. Existing sessions keep working until they
                    expire. Type the new suffix to confirm.
                  </p>
                </div>
                <input
                  value={domainConfirm}
                  onChange={(e) => setDomainConfirm(e.target.value)}
                  placeholder={domain.trim()}
                  className={field}
                />
              </div>
            )}

            <button
              onClick={() =>
                save(
                  { GOVERNMENT_EMAIL_DOMAIN: domain.trim() },
                  'the email domain',
                )
              }
              disabled={
                isSaving ||
                !domainChanged ||
                domainConfirm.trim() !== domain.trim()
              }
              className="rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              Save domain
            </button>
          </section>
        </>
      )}
    </PageContainer>
  );
}
