'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Database,
  KeyRound,
  Mail,
  Server,
  Settings2,
  ShieldAlert,
  Boxes,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { PageContainer } from '@/components/ui/page-container';
import { Skeleton } from '@/components/ui/skeleton';

interface Check {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

interface Overview {
  checkedAt: string;
  process: {
    uptimeSeconds: number;
    nodeVersion: string;
    heapUsedMb: number;
    rssMb: number;
  };
  database: Check;
  cache: Check;
  queue: {
    status: 'up' | 'down';
    error?: string;
    paused?: boolean;
    counts?: Record<string, number>;
    oldestWaitingAgeSeconds?: number | null;
    recentFailures?: { name: string; count: number; lastReason: string }[];
  };
  content: Record<string, number | string> & { status: 'up' | 'down'; error?: string };
  auth: {
    status: 'up' | 'down';
    error?: string;
    activeSessions?: number;
    lockedAccounts?: number;
    failedSignIns24h?: number;
    successfulSignIns24h?: number;
  };
  activity: {
    status: 'up' | 'down';
    error?: string;
    events24h?: number;
    failures24h?: number;
    failureRate?: number;
    failuresByAction?: { action: string; category: string; count: number }[];
  };
  config: {
    mailConfigured: boolean;
    emailFrom: string | null;
    uploadsConfigured: boolean;
    webUrl: string | null;
    webUrlLooksRight: boolean;
    supportEmail: string | null;
    sessionTimeoutSeconds: number;
    governmentEmailDomain: string;
    nodeEnv: string;
    warnings: string[];
  };
}

function duration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${seconds}s`;
}

function Dot({ up }: { up: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
        up ? 'bg-success' : 'bg-destructive'
      }`}
    />
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-border bg-card p-6 max-sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="font-semibold text-primary">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/** A label over a number. The unit of this whole page. */
function Figure({
  label,
  value,
  tone = 'normal',
  hint,
}: {
  label: string;
  value: string | number;
  tone?: 'normal' | 'warn' | 'bad';
  hint?: string;
}) {
  const colour =
    tone === 'bad'
      ? 'text-destructive'
      : tone === 'warn'
        ? 'text-stat-gold-fg'
        : 'text-foreground';
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-1 text-2xl font-semibold ${colour}`}>{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">{children}</dl>
  );
}

function Unavailable({ error }: { error?: string }) {
  return (
    <p className="text-sm text-destructive">
      {error ?? 'Could not be read.'}
    </p>
  );
}

/**
 * The operations console.
 *
 * Ordered by how urgently something would make someone act: what is
 * misconfigured, then what is failing, then what is merely true. Everything
 * here is a count, a latency or a setting — nothing that says what a ministry
 * discussed or who attended.
 */
export function PlatformHealthView() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['platform-overview'],
    queryFn: () => apiFetch<Overview>('/api/v1/platform/overview'),
    // An operator leaves this open and expects it to keep telling the truth.
    // Thirty rather than fifteen seconds: the page now asks for a dozen counts
    // and a queue read each time, and none of these numbers move faster.
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-[1.25rem]" />
          <Skeleton className="h-40 rounded-[1.5rem]" />
          <Skeleton className="h-40 rounded-[1.5rem]" />
        </div>
      </PageContainer>
    );
  }

  if (isError || !data) {
    return (
      <PageContainer>
        <div className="rounded-[1.5rem] border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
          Could not reach the API to ask how it is. That is itself an answer —
          check the process and the proxy.
        </div>
      </PageContainer>
    );
  }

  const { queue, content, auth, activity, config } = data;
  const failing = (activity.failures24h ?? 0) > 0;
  const queueBacked = (queue.counts?.failed ?? 0) > 0;

  return (
    <PageContainer>
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-primary">
          <Activity className="h-6 w-6" aria-hidden /> Platform health
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Whether the platform is running, what is failing, and what is
          configured. Meetings, minutes and attendance are not shown here.
        </p>
      </header>

      <div className="space-y-6">
        {/* First, because a warning here means something is broken in a way
            nothing else on the page would reveal. */}
        {config.warnings.length > 0 && (
          <section className="rounded-[1.5rem] border border-stat-gold-border bg-stat-gold-bg p-6 max-sm:p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-stat-gold-fg">
              <ShieldAlert className="h-5 w-5" aria-hidden />
              Needs attention
            </h2>
            <ul className="space-y-2">
              {config.warnings.map((w) => (
                <li key={w} className="text-sm text-stat-gold-fg">
                  {w}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: 'Database',
              icon: <Database className="h-4 w-4" aria-hidden />,
              check: data.database,
            },
            {
              label: 'Cache',
              icon: <Server className="h-4 w-4" aria-hidden />,
              check: data.cache,
            },
          ].map(({ label, icon, check }) => (
            <div
              key={label}
              className="rounded-[1.25rem] border border-border bg-card p-5"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                {icon}
                <span className="text-sm font-medium">{label}</span>
              </div>
              <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-foreground">
                <Dot up={check.status === 'up'} />
                {check.status === 'up' ? 'Reachable' : 'Unreachable'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {check.error ??
                  (check.latencyMs !== undefined ? `${check.latencyMs} ms` : '—')}
              </p>
            </div>
          ))}

          <div className="rounded-[1.25rem] border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Activity className="h-4 w-4" aria-hidden />
              <span className="text-sm font-medium">API</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-foreground">
              Up {duration(data.process.uptimeSeconds)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Node {data.process.nodeVersion} · {data.process.rssMb} MB ·{' '}
              {config.nodeEnv}
            </p>
          </div>
        </div>

        <Section
          icon={<Mail className="h-5 w-5 text-muted-foreground" aria-hidden />}
          title="Mail queue"
        >
          {queue.status === 'down' ? (
            <Unavailable error={queue.error} />
          ) : (
            <>
              {queue.paused && (
                <p className="mb-4 rounded-[1rem] border border-stat-gold-border bg-stat-gold-bg p-3 text-sm text-stat-gold-fg">
                  The queue is paused. Nothing is being sent.
                </p>
              )}
              <Grid>
                {Object.entries(queue.counts ?? {}).map(([state, n]) => (
                  <Figure
                    key={state}
                    label={state}
                    value={n}
                    tone={state === 'failed' && n > 0 ? 'bad' : 'normal'}
                  />
                ))}
              </Grid>
              {queue.oldestWaitingAgeSeconds != null && (
                <p className="mt-4 text-sm text-muted-foreground">
                  {/* Depth alone says nothing; depth plus age says whether the
                      worker is running. */}
                  Oldest waiting job has been queued{' '}
                  <strong className="text-foreground">
                    {duration(queue.oldestWaitingAgeSeconds)}
                  </strong>
                  .
                </p>
              )}
              {!!queue.recentFailures?.length && (
                <div className="mt-6 space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <AlertTriangle
                      className="h-4 w-4 text-destructive"
                      aria-hidden
                    />
                    Recent failures
                  </h3>
                  <ul className="divide-y divide-border rounded-[1rem] border border-border">
                    {queue.recentFailures.map((f) => (
                      <li key={f.name} className="p-3">
                        <p className="text-sm font-medium text-foreground">
                          {f.name}{' '}
                          <span className="text-muted-foreground">
                            × {f.count}
                          </span>
                        </p>
                        <p className="mt-0.5 break-words text-xs text-muted-foreground">
                          {f.lastReason}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!queueBacked && !queue.recentFailures?.length && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Nothing has failed to send.
                </p>
              )}
            </>
          )}
        </Section>

        <Section
          icon={<KeyRound className="h-5 w-5 text-muted-foreground" aria-hidden />}
          title="Sign-in"
        >
          {auth.status === 'down' ? (
            <Unavailable error={auth.error} />
          ) : (
            <Grid>
              <Figure label="Active sessions" value={auth.activeSessions ?? 0} />
              <Figure
                label="Signed in (24h)"
                value={auth.successfulSignIns24h ?? 0}
              />
              <Figure
                label="Failed (24h)"
                value={auth.failedSignIns24h ?? 0}
                tone={(auth.failedSignIns24h ?? 0) > 20 ? 'warn' : 'normal'}
                hint={
                  (auth.failedSignIns24h ?? 0) > 20
                    ? 'High enough to be worth a look'
                    : undefined
                }
              />
              <Figure
                label="Locked out"
                value={auth.lockedAccounts ?? 0}
                tone={(auth.lockedAccounts ?? 0) > 0 ? 'warn' : 'normal'}
                hint={
                  (auth.lockedAccounts ?? 0) > 0
                    ? 'Clears on its own after 15 minutes'
                    : undefined
                }
              />
            </Grid>
          )}
        </Section>

        <Section
          icon={
            <AlertTriangle className="h-5 w-5 text-muted-foreground" aria-hidden />
          }
          title="Activity, last 24 hours"
        >
          {activity.status === 'down' ? (
            <Unavailable error={activity.error} />
          ) : (
            <>
              <Grid>
                <Figure label="Recorded actions" value={activity.events24h ?? 0} />
                <Figure
                  label="Failures"
                  value={activity.failures24h ?? 0}
                  tone={failing ? 'bad' : 'normal'}
                />
                <Figure
                  label="Failure rate"
                  value={`${activity.failureRate ?? 0}%`}
                  tone={(activity.failureRate ?? 0) > 5 ? 'bad' : 'normal'}
                />
              </Grid>
              {!!activity.failuresByAction?.length && (
                <ul className="mt-6 divide-y divide-border rounded-[1rem] border border-border">
                  {activity.failuresByAction.map((f) => (
                    <li
                      key={f.action}
                      className="flex items-center justify-between gap-3 p-3"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {f.action}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {f.category}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-destructive">
                        {f.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {!failing && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Nothing has failed. This counts every recorded action across
                  every ministry, not only errors people reported.
                </p>
              )}
            </>
          )}
        </Section>

        <Section
          icon={<Boxes className="h-5 w-5 text-muted-foreground" aria-hidden />}
          title="What is on the platform"
        >
          {content.status === 'down' ? (
            <Unavailable error={content.error} />
          ) : (
            <Grid>
              <Figure
                label="Ministries"
                value={`${content.activeMinistries}/${content.ministries}`}
                hint="active of total"
              />
              <Figure
                label="Accounts"
                value={`${content.activeUsers}/${content.users}`}
                hint={
                  Number(content.erasedUsers) > 0
                    ? `${content.erasedUsers} erased`
                    : 'active of total'
                }
              />
              <Figure
                label="Events"
                value={content.events}
                hint={`${content.upcomingEvents} upcoming`}
              />
              <Figure
                label="Minutes"
                value={content.minutes}
                hint={`${content.publishedMinutes} published`}
              />
              <Figure label="Check-ins" value={content.attendance} />
              <Figure
                label="Action items"
                value={content.actionItems}
                hint={`${content.openActionItems} open`}
              />
              <Figure
                label="Staff roster"
                value={content.staffDirectory}
                hint="not yet onboarded"
              />
            </Grid>
          )}
        </Section>

        <Section
          icon={
            <Settings2 className="h-5 w-5 text-muted-foreground" aria-hidden />
          }
          title="Configuration"
        >
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {[
              ['Mail provider', config.mailConfigured ? 'Configured' : 'Not configured'],
              ['Sends as', config.emailFrom ?? 'not set'],
              [
                'Emailed links point at',
                config.webUrl
                  ? `${config.webUrl}${config.webUrlLooksRight ? '' : ' — wrong for this environment'}`
                  : 'not set',
              ],
              ['Support address', config.supportEmail ?? 'not set'],
              ['Image uploads', config.uploadsConfigured ? 'Configured' : 'Not configured'],
              ['Sign-in domain', config.governmentEmailDomain],
              ['Session timeout', duration(config.sessionTimeoutSeconds)],
              ['Environment', config.nodeEnv],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-4 border-b border-border pb-2"
              >
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="text-right text-sm font-medium text-foreground">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <p className="text-xs text-muted-foreground">
          Checked {new Date(data.checkedAt).toLocaleTimeString()} · refreshes
          every 30 seconds
        </p>
      </div>
    </PageContainer>
  );
}
