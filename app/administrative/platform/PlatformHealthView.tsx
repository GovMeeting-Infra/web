'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, Database, Server, Mail, AlertTriangle } from 'lucide-react';
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
  uptimeSeconds: number;
  nodeVersion: string;
  database: Check;
  cache: Check;
  queue: {
    status: 'up' | 'down';
    error?: string;
    counts?: Record<string, number>;
    recentFailures?: { name: string; count: number; lastReason: string }[];
  };
}

/** Seconds → something an operator can read at a glance. */
function uptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatusDot({ status }: { status: 'up' | 'down' }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
        status === 'up' ? 'bg-success' : 'bg-destructive'
      }`}
    />
  );
}

function Tile({
  icon,
  label,
  check,
}: {
  icon: React.ReactNode;
  label: string;
  check: Check;
}) {
  return (
    <div className="rounded-[1.25rem] border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-foreground">
        <StatusDot status={check.status} />
        {check.status === 'up' ? 'Reachable' : 'Unreachable'}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {check.error ?? (check.latencyMs !== undefined ? `${check.latencyMs} ms` : '—')}
      </p>
    </div>
  );
}

/**
 * The operations console.
 *
 * Deliberately narrow. Mail is the part worth the page: one queue carries every
 * message the platform sends, and publishing minutes enqueues a job per
 * recipient — so a large meeting can burst past the provider's rate limit with
 * a rising failed count as the only sign. Nothing here names a recipient.
 */
export function PlatformHealthView() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['platform-overview'],
    queryFn: () => apiFetch<Overview>('/api/v1/platform/overview'),
    // An operator leaves this open and expects it to keep telling the truth.
    refetchInterval: 15_000,
  });

  return (
    <PageContainer>
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-primary">
          <Activity className="h-6 w-6" aria-hidden /> Platform health
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Whether the platform is running, and what is failing if it is not.
          Meetings, minutes and attendance are not shown here.
        </p>
      </header>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-[1.25rem]" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-[1.25rem] border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
          Could not reach the API to ask how it is. That is itself an answer —
          check the process and the proxy.
        </div>
      )}

      {data && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Tile
              icon={<Database className="h-4 w-4" aria-hidden />}
              label="Database"
              check={data.database}
            />
            <Tile
              icon={<Server className="h-4 w-4" aria-hidden />}
              label="Cache"
              check={data.cache}
            />
            <div className="rounded-[1.25rem] border border-border bg-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Activity className="h-4 w-4" aria-hidden />
                <span className="text-sm font-medium">API</span>
              </div>
              <p className="mt-2 text-lg font-semibold text-foreground">
                Up {uptime(data.uptimeSeconds)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Node {data.nodeVersion}
              </p>
            </div>
          </div>

          <section className="rounded-[1.5rem] border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted-foreground" aria-hidden />
              <h2 className="font-semibold text-primary">Mail queue</h2>
              <StatusDot status={data.queue.status} />
            </div>

            {data.queue.status === 'down' ? (
              <p className="text-sm text-destructive">
                {data.queue.error ?? 'The queue could not be read.'}
              </p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                  {Object.entries(data.queue.counts ?? {}).map(([state, n]) => (
                    <div key={state}>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        {state}
                      </dt>
                      <dd
                        className={`text-2xl font-semibold ${
                          state === 'failed' && n > 0
                            ? 'text-destructive'
                            : 'text-foreground'
                        }`}
                      >
                        {n}
                      </dd>
                    </div>
                  ))}
                </dl>

                {!!data.queue.recentFailures?.length && (
                  <div className="mt-6 space-y-2">
                    <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
                      Recent failures
                    </h3>
                    {/* Grouped by job name: twenty rows of one failure is one
                        problem, and reading it as twenty wastes the first five
                        minutes of an incident. */}
                    <ul className="divide-y divide-border rounded-[1rem] border border-border">
                      {data.queue.recentFailures.map((f) => (
                        <li key={f.name} className="p-3">
                          <p className="text-sm font-medium text-foreground">
                            {f.name}{' '}
                            <span className="text-muted-foreground">× {f.count}</span>
                          </p>
                          <p className="mt-0.5 break-words text-xs text-muted-foreground">
                            {f.lastReason}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>

          <p className="text-xs text-muted-foreground">
            Checked {new Date(data.checkedAt).toLocaleTimeString()} · refreshes
            every 15 seconds
          </p>
        </div>
      )}
    </PageContainer>
  );
}
