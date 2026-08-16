'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Download,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { StatCardsSkeleton } from '@/components/ui/skeletons';
import { CSV_EXPORTS, type AnalyticsDashboard } from '@/lib/types/reports';
import { ACTION_ITEM_STATUS_DOT } from '@/lib/types/events';
import { Tooltip } from '@/components/ui/tooltip';
import { ROLE_LABELS } from '@/lib/types/account';
import type { SystemRole } from '@/lib/session';
import { PageContainer } from '@/components/ui/page-container';

/** Keeps the existing card shape; only the numbers are real now. */
function ReportCard({
  title,
  description,
  metrics,
  hints,
  period,
  icon,
}: {
  title: string;
  description: string;
  metrics: Record<string, string | number>;
  /** What each figure actually counts, keyed by the same name. */
  hints?: Record<string, string>;
  period: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group rounded-[1.75rem] border border-border bg-surface-raised p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)] transition-all hover:shadow-[0_16px_40px_rgba(0,53,128,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-primary">{title}</h3>
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
          {icon}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 sm:grid-cols-3">
        {Object.entries(metrics).map(([key, value]) => (
          <Tooltip key={key} content={hints?.[key]} disabled={!hints?.[key]}>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </p>
              <p className="mt-1 text-lg font-bold text-primary">{value}</p>
            </div>
          </Tooltip>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-2 border-t border-slate-200 pt-4 text-sm text-slate-600">
        <Calendar className="h-4 w-4" />
        {period}
      </div>
    </div>
  );
}

/** Proportional bar in the page's own palette, rather than a chart library. */
function ProportionBar({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((n, s) => n + s.value, 0);

  if (total === 0) {
    return (
      <p className="mt-4 text-sm text-slate-500">No data recorded yet.</p>
    );
  }

  return (
    <>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-secondary">
        {segments.map((s) =>
          s.value > 0 ? (
            <Tooltip key={s.label} content={`${s.label}: ${s.value}`}>
              <div
                className={s.color}
                style={{ width: `${(s.value / total) * 100}%` }}
              />
            </Tooltip>
          ) : null,
        )}
      </div>
      <ul className="mt-4 space-y-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
              {s.label}
            </span>
            <span className="font-semibold text-primary">
              {s.value}
              <span className="ml-1 text-xs font-normal text-slate-500">
                ({Math.round((s.value / total) * 100)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function ReportsView({ scopeLabel }: { scopeLabel: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['reports-analytics'],
    queryFn: () => apiFetch<AnalyticsDashboard>('/api/v1/reports/analytics'),
  });

  const period = data
    ? new Date(data.generatedAt).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : '—';

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const maxMonth = Math.max(1, ...(data?.eventsOverTime ?? []).map((m) => m.count));

  return (
    <PageContainer className="space-y-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-success">
          Insight centre
        </p>
        <h1 className="text-3xl font-bold text-primary">Reports &amp; Analytics</h1>
        <p className="mt-2 text-slate-600">{scopeLabel}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load analytics'}
        </div>
      )}

      {isLoading && (
        <StatCardsSkeleton />
      )}

      {data && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <ReportCard
              title="Attendance Summary"
              description="Overview of attendance across all events"
              period={period}
              icon={<BarChart3 className="h-6 w-6 text-primary" />}
              metrics={{
                attendance: pct(data.attendanceStats.attendanceRate),
                events: data.eventStats.total,
                checkIns: data.attendanceStats.totalCheckIns,
              }}
              hints={{
                attendance:
                  'Of everyone invited across all meetings, the share who actually checked in.',
                events: 'Every meeting and activity in your ministry.',
                checkIns:
                  'Every individual check-in recorded, including walk-ins who were never invited.',
              }}
            />

            <ReportCard
              title="Event Performance"
              description="Analysis of event participation and engagement"
              period={period}
              icon={<TrendingUp className="h-6 w-6 text-primary" />}
              metrics={{
                upcoming: data.eventStats.upcoming,
                past: data.eventStats.past,
                totalEvents: data.eventStats.total,
              }}
              hints={{
                upcoming: 'Scheduled and not started yet.',
                past: 'Already finished.',
                totalEvents: 'Everything, whenever it happened.',
              }}
            />

            {/* Not a ReportCard: three numbers side by side implied that
                completed, in progress and overdue were peers, and overdue is
                not — an overdue item is also a to-do, so it belongs beside the
                bar rather than inside it. */}
            <section className="min-w-0 rounded-[1.75rem] border border-border bg-surface-raised p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold text-primary">
                    Action Items Progress
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Where the work from meetings has got to
                  </p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
              </div>

              <ProportionBar
                segments={[
                  {
                    label: 'To do',
                    value: data.actionItemStats.todo,
                    color: ACTION_ITEM_STATUS_DOT.TODO,
                  },
                  {
                    label: 'In progress',
                    value: data.actionItemStats.inProgress,
                    color: ACTION_ITEM_STATUS_DOT.IN_PROGRESS,
                  },
                  {
                    label: 'Done',
                    value: data.actionItemStats.completed,
                    color: ACTION_ITEM_STATUS_DOT.COMPLETED,
                  },
                ]}
              />

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 pt-4 text-sm">
                {/* Cuts across the bar rather than sitting in it: an overdue
                    item is counted again in To do or In progress. */}
                <span className="text-slate-600">
                  <span className="font-semibold text-destructive">
                    {data.actionItemStats.overdue}
                  </span>{' '}
                  overdue
                </span>
                {data.actionItemStats.cancelled > 0 && (
                  <span className="text-slate-500">
                    {data.actionItemStats.cancelled} cancelled, not counted
                    above
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-4 text-sm text-slate-600">
                <Calendar className="h-4 w-4" />
                {period}
              </div>
            </section>


            {/* userStats was fetched but never rendered, so the People figures
                appeared on the dashboard and nowhere on this page. */}
            <ReportCard
              title="People"
              description="Accounts and sign-in activity"
              period={period}
              icon={<Users className="h-6 w-6 text-primary" />}
              hints={{
                active:
                  'Accounts that can sign in. Deactivated and erased accounts are excluded.',
                total: 'Every account, active or not.',
                'avg. sign-ins':
                  'How often an average account signs in, across the accounts that ever have.',
              }}
              metrics={{
                active: data.userStats.activeUsers,
                total: data.userStats.totalUsers,
                'avg. sign-ins': Math.round(
                  data.userStats.averageLoginFrequency,
                ),
              }}
            />
          </div>

          {data.userStats.usersByRole.length > 0 && (
            <section className="rounded-[1.75rem] border border-border bg-surface-raised p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)]">
              <h2 className="font-semibold text-primary">People by role</h2>
              <p className="mt-2 text-sm text-slate-600">
                Who holds which level of access
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {data.userStats.usersByRole.map((r) => (
                  <div
                    key={r.role}
                    className="rounded-xl border border-border bg-white p-4"
                  >
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {ROLE_LABELS[r.role as SystemRole] ?? r.role}
                    </dt>
                    <dd className="mt-1.5 text-2xl font-bold text-primary">
                      {r.count}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* min-w-0 on both columns, not just the one with the chart. Grid
              tracks are minmax(auto, 1fr), and `auto` floors a column at its
              min-content width — so the bar chart's min-w-[28rem] made its
              column refuse to shrink, the overflow-x-auto below never engaged,
              and the grid grew wider than the page, carrying both cards out
              with it. */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Check-in methods */}
            <section className="min-w-0 rounded-[1.75rem] border border-border bg-surface-raised p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)]">
              <h2 className="font-semibold text-primary">Check-in Methods</h2>
              <p className="mt-2 text-sm text-slate-600">
                Whether people signed themselves in, or someone did it for them
              </p>
              {/* QR and Geofence were two bars for the same act — scanning the
                  code and signing — differing only in whether the organizer had
                  anchored a check-in area. The distinction worth drawing is who
                  did the signing. */}
              <ProportionBar
                segments={[
                  {
                    label: 'Checked in themselves',
                    value: data.checkInMethods.qr + data.checkInMethods.geo,
                    color: 'bg-primary',
                  },
                  {
                    label: 'Recorded by an organizer',
                    value: data.checkInMethods.manual,
                    color: 'bg-success',
                  },
                ]}
              />
              {data.checkInMethods.geo > 0 && (
                // "Checked", not "verified": a measured position may still have
                // been too vague to prove, and only the attendance record
                // separates those two.
                <p className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-600">
                  <span className="font-semibold text-primary">
                    {data.checkInMethods.geo}
                  </span>{' '}
                  of those had their location checked against the venue.
                </p>
              )}
            </section>

            {/* Events over time */}
            <section className="min-w-0 rounded-[1.75rem] border border-border bg-surface-raised p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)]">
              <h2 className="font-semibold text-primary">Events Created</h2>
              <p className="mt-2 text-sm text-slate-600">Last 12 months</p>

              <div className="mt-6 -mx-2 overflow-x-auto px-2">
                <div className="flex h-32 min-w-[28rem] items-end gap-1">
                {data.eventsOverTime.map((m) => (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                    <Tooltip
                      content={`${m.month}: ${m.count} ${
                        m.count === 1 ? 'event' : 'events'
                      }`}
                    >
                      <div
                        className="w-full rounded-t bg-primary transition-all"
                        style={{
                          height: `${Math.max(2, (m.count / maxMonth) * 100)}%`,
                          opacity: m.count === 0 ? 0.15 : 1,
                        }}
                      />
                    </Tooltip>
                    <span className="text-[10px] text-slate-500">
                      {m.month.slice(5)}
                    </span>
                  </div>
                ))}
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-[2rem] border border-border bg-surface-raised p-8 shadow-[0_24px_70px_rgba(0,53,128,0.08)] max-sm:p-4">
            <h2 className="text-2xl font-bold text-primary">Quick Export</h2>
            <p className="mt-2 text-slate-600">Download report data as CSV</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {CSV_EXPORTS.map((e) => (
                // Plain links: the Next /api/* rewrite proxies these with the
                // session cookie, so the browser downloads them directly.
                <Tooltip key={e.dataset} content={e.hint}>
                  <a
                    href={`/api/v1/reports/export/${e.dataset}`}
                    className="flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-3 font-medium text-primary transition-all hover:border-primary hover:bg-secondary"
                  >
                    <Download className="h-4 w-4" />
                    {e.label}
                  </a>
                </Tooltip>
              ))}
            </div>
          </section>
        </>
      )}
    </PageContainer>
  );
}
