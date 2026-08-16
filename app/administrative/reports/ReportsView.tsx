'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Download,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { apiFetch, apiDownload, messageFor } from '@/lib/api/client';
import { CardGridSkeleton } from '@/components/ui/skeletons';
import { CSV_EXPORTS, type AnalyticsDashboard } from '@/lib/types/reports';
import { ACTION_ITEM_STATUS_DOT } from '@/lib/types/events';
import { ROLE_LABELS } from '@/lib/types/account';
import type { SystemRole } from '@/lib/session';
import { PageContainer } from '@/components/ui/page-container';

/** Keeps the existing card shape; only the numbers are real now. */
function ReportCard({
  title,
  description,
  metrics,
  asOf,
  icon,
}: {
  title: string;
  description: string;
  /**
   * Explicit label, value and explanation per figure.
   *
   * This was a Record keyed by field name, with the label derived by inserting
   * a space before every capital — so `checkIns` rendered as "CHECK INS" and
   * `totalEvents` as "TOTAL EVENTS". One entry was hand-written as
   * 'avg. sign-ins' purely to defeat that regex, which is the tell that the
   * mechanism was wrong. Display copy is never derived from a data key.
   */
  metrics: { label: string; value: string | number; hint: string }[];
  asOf: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group rounded-[1.75rem] border border-border bg-surface-raised p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)] transition-all hover:shadow-[0_16px_40px_rgba(0,53,128,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-primary">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
          {icon}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 border-t border-border pt-4 sm:grid-cols-3">
        {/* The explanations are permanent text, not tooltips. Every hint on
            this page used to hang off a bare div, so the sentences that make
            these numbers safe to read reached mouse users only — and on a page
            read far more often than it is clicked, having them always visible
            is the better design anyway. */}
        {metrics.map((m) => (
          <div key={m.label}>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {m.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-primary">{m.value}</p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              {m.hint}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4" aria-hidden />
        {asOf}
      </div>
    </div>
  );
}

/**
 * "Sep" rather than "09", and the year where it turns.
 *
 * The axis printed a bare two-digit month, so a window crossing a year read
 * "09 10 11 12 01 02" with nothing marking the boundary.
 */
function monthLabel(month: string, long = false): string {
  const [y, m] = month.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (long) {
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  const short = d.toLocaleDateString(undefined, { month: 'short' });
  return m === '01' ? `${short} ${y.slice(2)}` : short;
}

/**
 * One period figure with its change against the period before.
 *
 * The direction is stated in words as well as colour and an arrow, because
 * "down 6" and "up 6" are the whole message and colour alone cannot carry it.
 */
function TrendFigure({
  label,
  value,
  delta,
  unit,
  detail,
}: {
  label: string;
  value: string | number;
  delta: number;
  unit?: string;
  detail: string;
}) {
  const flat = delta === 0;
  const up = delta > 0;

  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd>
        <span className="mt-1 block text-2xl font-bold text-primary">
          {value}
        </span>
        <span
          className={`mt-1 flex items-center gap-1 text-sm font-medium ${
            flat
              ? 'text-muted-foreground'
              : up
                ? 'text-success'
                : 'text-alert-fg'
          }`}
        >
          {!flat &&
            (up ? (
              <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ))}
          {flat
            ? 'Unchanged'
            : `${up ? 'Up' : 'Down'} ${Math.abs(delta)}${unit ? ` ${unit}` : ''} on the month before`}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {detail}
        </span>
      </dd>
    </div>
  );
}

/** Proportional bar in the page's own palette, rather than a chart library. */
function ProportionBar({
  segments,
  emptyLabel = 'Nothing recorded yet.',
}: {
  /** `note` carries what the number means, where the label alone would mislead. */
  segments: { label: string; value: number; color: string; note?: string }[];
  emptyLabel?: string;
}) {
  const total = segments.reduce((n, s) => n + s.value, 0);

  if (total === 0) {
    return <p className="mt-4 text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <>
      {/* Decorative. Every value below is in the legend as real text, and the
          bar's segments were tooltip triggers on bare divs — unreachable by
          keyboard and, for a 1-in-400 segment, a sub-pixel target. */}
      <div
        aria-hidden
        className="mt-4 flex h-3 overflow-hidden rounded-full bg-secondary"
      >
        {segments.map((s) =>
          s.value > 0 ? (
            <div
              key={s.label}
              className={s.color}
              style={{ width: `${(s.value / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-4 space-y-2">
        {segments.map((s) => (
          <li key={s.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.color}`} />
                {s.label}
              </span>
              <span className="font-semibold text-primary">
                {s.value}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({Math.round((s.value / total) * 100)}%)
                </span>
              </span>
            </div>
            {s.note && (
              <p className="ml-4.5 mt-0.5 text-xs text-muted-foreground">
                {s.note}
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function ReportsView({ scopeLabel }: { scopeLabel: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reports-analytics'],
    queryFn: () => apiFetch<AnalyticsDashboard>('/api/v1/reports/analytics'),
  });

  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const download = async (dataset: string, label: string) => {
    setDownloadError(null);
    setDownloading(dataset);
    try {
      await apiDownload(`/api/v1/reports/export/${dataset}`, `${dataset}.csv`);
    } catch (err) {
      setDownloadError(
        messageFor(err, `Couldn't prepare the ${label}. Try again in a moment.`),
      );
    } finally {
      setDownloading(null);
    }
  };

  const totalCreated = (data?.eventsOverTime ?? []).reduce(
    (n, m) => n + m.count,
    0,
  );

  /**
   * When these figures were computed — not the period they cover.
   *
   * This used to format `generatedAt` as "August 2026" beside a calendar icon,
   * stamped on three cards whose queries have no date filter at all. A month
   * under a calendar icon is universally read as "the period this covers", so
   * an all-time total was being repeated upward as a monthly figure. The
   * dashboard already says it correctly; the more authoritative page did not.
   */
  const asOf = data
    ? `Running totals · as of ${new Date(data.generatedAt).toLocaleTimeString(
        undefined,
        { hour: '2-digit', minute: '2-digit' },
      )}`
    : 'Running totals';

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const maxMonth = Math.max(1, ...(data?.eventsOverTime ?? []).map((m) => m.count));

  return (
    <PageContainer className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-primary">Reports</h1>
        <p className="mt-2 text-lg font-medium text-foreground">{scopeLabel}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything below is a running total since this ministry started using
          the platform, unless a figure says otherwise. Figures are recalculated
          hourly.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-[1.5rem] border border-alert-border bg-alert-bg p-6 text-center"
        >
          <p className="font-medium text-alert-fg">
            We couldn&apos;t load the figures.
          </p>
          <p className="mt-1 text-sm text-alert-fg/90">
            This is a connection problem, not an empty ministry.
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
        // Four large cards in a two-column grid, which is what actually
        // arrives. StatCardsSkeleton drew four small tiles in a four-column
        // row, so the page jumped roughly its own height when data landed.
        <CardGridSkeleton cards={4} label="Loading the figures" />
      )}

      {data && !error && (
        <>
          {/* The one thing this page never had: something to compare against.
              26 figures, no baseline, no trend, no target — so a number was
              absorbed as identity ("we are an 84% ministry") rather than read
              as a measurement. This block is explicitly windowed, unlike the
              running totals below it. */}
          <section className="rounded-[1.75rem] border border-border bg-surface-raised p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)]">
            <h2 className="font-semibold text-primary">The last 30 days</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Compared with the 30 days before them. This is the only section
              on the page limited to a period.
            </p>
            <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <TrendFigure
                label="Turnout"
                value={pct(data.trend.current.attendanceRate)}
                delta={
                  Math.round(data.trend.current.attendanceRate * 100) -
                  Math.round(data.trend.previous.attendanceRate * 100)
                }
                unit="pts"
                detail={`${data.trend.current.checkIns} check-ins against ${data.trend.current.invited} invitations`}
              />
              <TrendFigure
                label="Meetings held"
                value={data.trend.current.meetings}
                delta={
                  data.trend.current.meetings - data.trend.previous.meetings
                }
                detail={`${data.trend.previous.meetings} in the 30 days before`}
              />
              <TrendFigure
                label="Check-ins"
                value={data.trend.current.checkIns}
                delta={
                  data.trend.current.checkIns - data.trend.previous.checkIns
                }
                detail={`${data.trend.previous.checkIns} in the 30 days before`}
              />
            </dl>
          </section>

          {/* The thing this product exists to produce, measured for the first
              time. PRODUCT.md calls the attendance record the product and asks
              for the evidence rather than the verdict; every column below was
              already stored and already in the CSV export, and none of it
              reached this page. */}
          <section className="rounded-[1.75rem] border border-border bg-surface-raised p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold text-primary">
                  How much of this would survive a challenge
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Across every check-in on a published meeting. A record with a
                  signature and a position inside the check-in area is the one
                  that is hardest to dispute.
                </p>
              </div>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
                <ShieldCheck className="h-6 w-6 text-primary" aria-hidden />
              </div>
            </div>

            {data.evidence.total === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">
                No check-ins recorded yet.
              </p>
            ) : (
              <dl className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Signed
                  </dt>
                  <dd>
                    <span className="mt-1 block text-2xl font-bold text-primary">
                      {pct(data.evidence.signed / data.evidence.total)}
                    </span>
                    <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                      {data.evidence.signed} of {data.evidence.total} carry a
                      signature drawn on the attendee&apos;s own device. The
                      rest were recorded by an organiser, with nobody at the
                      device to sign.
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Inside the area
                  </dt>
                  <dd>
                    <span className="mt-1 block text-2xl font-bold text-primary">
                      {pct(data.evidence.insideArea / data.evidence.total)}
                    </span>
                    <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                      {data.evidence.insideArea} were placed within 100m of
                      where the organiser stood.{' '}
                      {data.evidence.unverified > 0 &&
                        `${data.evidence.unverified} could not be judged — no area was set, or the reading was too vague.`}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Worth a look
                  </dt>
                  <dd>
                    <span className="mt-1 block text-2xl font-bold text-primary">
                      {data.evidence.outsideArea + data.evidence.mockFlagged}
                    </span>
                    <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                      {data.evidence.outsideArea} recorded outside the area
                      {data.evidence.mockFlagged > 0
                        ? `, and ${data.evidence.mockFlagged} where the phone reported a location that could not be genuine`
                        : ''}
                      . Neither is proof of anything on its own — both are kept
                      so a person can judge.
                    </span>
                  </dd>
                </div>
              </dl>
            )}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <ReportCard
              title="Turnout"
              description="Check-ins measured against invitations, across every published meeting."
              asOf={asOf}
              icon={<BarChart3 className="h-6 w-6 text-primary" aria-hidden />}
              metrics={[
                {
                  label: 'Turnout',
                  value: pct(data.attendanceStats.attendanceRate),
                  // The counts, right under the rate. A percentage whose
                  // numerator and denominator are visible is much harder to
                  // quote out of shape than a bare "84%".
                  hint: `${data.attendanceStats.invitedWhoCame} of ${data.attendanceStats.totalInvited} invited people turned up.`,
                },
                {
                  label: 'Walk-ins',
                  value: data.attendanceStats.walkIns,
                  // Counted here rather than in the rate above. They have no
                  // invitation, so including them produced a "turnout" over
                  // 100% — two different populations divided by each other.
                  hint: 'Turned up without an invitation. Not part of the turnout figure, because there was no invitation to measure them against.',
                },
                {
                  label: 'All check-ins',
                  value: data.attendanceStats.totalCheckIns,
                  hint: 'Invited people and walk-ins together.',
                },
              ]}
            />

            <ReportCard
              title="Meetings"
              description="Scheduled, held, and the total across both."
              asOf={asOf}
              icon={<TrendingUp className="h-6 w-6 text-primary" aria-hidden />}
              metrics={[
                {
                  label: 'Still to come',
                  value: data.eventStats.upcoming,
                  hint: 'Starts after now.',
                },
                {
                  label: 'Finished',
                  value: data.eventStats.past,
                  hint: 'Ended before now.',
                },
                {
                  label: 'All meetings',
                  value: data.eventStats.total,
                  // These three do not add up, and saying so is cheaper than
                  // letting someone discover it and distrust the page.
                  hint: 'Everything on record, including drafts, cancellations and anything running right now — so more than the two figures beside it.',
                },
              ]}
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
                  <p className="mt-2 text-sm text-muted-foreground">
                    Where the work from meetings has got to
                  </p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
              </div>

              <ProportionBar
                emptyLabel="No actions raised yet. They appear here once minutes are published."
                segments={[
                  {
                    // Neutral, not the destructive red. Red is doing overdue
                    // duty six lines below, and one colour cannot mean both
                    // "not started" and "late" in a single card.
                    label: 'To do or blocked',
                    value: data.actionItemStats.todo,
                    color: 'bg-muted-foreground',
                    note: 'Includes blocked items — they are still waiting to be done.',
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

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-4 text-sm">
                {/* Cuts across the bar rather than sitting in it: an overdue
                    item is counted again in To do or In progress. Hidden at
                    zero, because "0 overdue" rendered directly beneath "No
                    actions raised yet" and read as a contradiction. */}
                {data.actionItemStats.overdue > 0 && (
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-alert-fg">
                      {data.actionItemStats.overdue}
                    </span>{' '}
                    past their due date
                  </span>
                )}
                {data.actionItemStats.cancelled > 0 && (
                  <span className="text-muted-foreground">
                    {data.actionItemStats.cancelled} cancelled, not in the bar
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4" aria-hidden />
                {asOf}
              </div>
            </section>


            {/* userStats was fetched but never rendered, so the People figures
                appeared on the dashboard and nowhere on this page. */}
            <ReportCard
              title="People"
              description="Who has an account, and who is still using it."
              asOf={asOf}
              icon={<Users className="h-6 w-6 text-primary" aria-hidden />}
              metrics={[
                {
                  label: 'Signed in recently',
                  value: data.userStats.activeUsers,
                  // The old hint claimed this was an eligibility count and
                  // that erased accounts were excluded. Neither was true.
                  hint: 'Signed in at least once in the last 30 days.',
                },
                {
                  label: 'On the books',
                  value: data.userStats.totalUsers,
                  hint: 'Every account that can still sign in. Erased accounts are not counted.',
                },
                {
                  label: 'Last signed in',
                  // Was labelled "avg. sign-ins" and read as engagement. It is
                  // the mean days since last login: higher is worse.
                  value: `${Math.round(data.userStats.averageDaysSinceLastLogin)} days ago`,
                  hint: 'Averaged across accounts that have ever signed in. A rising number means people are drifting away from the platform.',
                },
              ]}
            />
          </div>

          {data.userStats.usersByRole.length > 0 && (
            <section className="rounded-[1.75rem] border border-border bg-surface-raised p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)]">
              <h2 className="font-semibold text-primary">People by role</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Who holds which level of access
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {data.userStats.usersByRole.map((r) => (
                  <div
                    key={r.role}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
              <h2 className="font-semibold text-primary">How people checked in</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Whether people signed themselves in, or someone did it for them
              </p>
              {/* QR and Geofence were two bars for the same act — scanning the
                  code and signing — differing only in whether the organizer had
                  anchored a check-in area. The distinction worth drawing is who
                  did the signing. */}
              <ProportionBar
                emptyLabel="No check-ins recorded yet."
                segments={[
                  {
                    // Green belongs on the path that captures a signature. It
                    // was on the organiser-recorded one, so the colour system
                    // was rewarding the weaker evidence on the page whose job
                    // is reporting evidence quality.
                    label: 'Signed themselves in',
                    value: data.checkInMethods.qr + data.checkInMethods.geo,
                    color: 'bg-success',
                    note: 'Scanned the code and drew a signature.',
                  },
                  {
                    label: 'Recorded by an organiser',
                    value: data.checkInMethods.manual,
                    color: 'bg-muted-foreground',
                    note: 'No signature captured — nobody was at the device to sign.',
                  },
                ]}
              />
              {data.checkInMethods.geo > 0 && (
                // "Checked", not "verified": a measured position may still have
                // been too vague to prove, and only the attendance record
                // separates those two.
                <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
                  <span className="font-semibold text-primary">
                    {data.checkInMethods.geo}
                  </span>{' '}
                  of those had their position checked against the check-in area
                  the organiser set. The fence is anchored where the organiser
                  stood, not to the venue record.
                </p>
              )}
            </section>

            {/* Events over time */}
            <section className="min-w-0 rounded-[1.75rem] border border-border bg-surface-raised p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)]">
              <h2 className="font-semibold text-primary">Meetings scheduled</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                By the month they were created, over the last 12 months.
              </p>

              {totalCreated === 0 ? (
                <p className="mt-6 text-sm text-muted-foreground">
                  No meetings have been created in the last 12 months.
                </p>
              ) : (
                <>
                  <div className="mt-6 -mx-2 overflow-x-auto px-2">
                    <div
                      aria-hidden
                      className="flex h-32 min-w-[28rem] items-end gap-1"
                    >
                      {data.eventsOverTime.map((m) => (
                        <div
                          key={m.month}
                          className="flex flex-1 flex-col items-center gap-1"
                        >
                          {/* The count above the bar. It used to live only
                              inside a hover tooltip on a bare div — so on a
                              phone it needed a 500ms press on a 2.5px target,
                              and by keyboard it was unreachable entirely. */}
                          <span className="text-[10px] font-semibold text-primary">
                            {m.count > 0 ? m.count : ''}
                          </span>
                          <div
                            className={
                              m.count === 0
                                ? 'w-full rounded-t bg-border'
                                : 'w-full rounded-t bg-primary transition-all'
                            }
                            style={{
                              height: `${Math.max(2, (m.count / maxMonth) * 100)}%`,
                            }}
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {monthLabel(m.month)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* The same twelve values as a table, for anyone not reading
                      the bars. */}
                  <table className="sr-only">
                    <caption>Meetings created per month, last 12 months</caption>
                    <thead>
                      <tr>
                        <th scope="col">Month</th>
                        <th scope="col">Meetings created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.eventsOverTime.map((m) => (
                        <tr key={m.month}>
                          <th scope="row">{monthLabel(m.month, true)}</th>
                          <td>{m.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </section>
          </div>

          {/* Super admins only. The cross-ministry view was a single aggregate
              — the one number a platform operator could already guess, and the
              one they cannot act on. Ranked, because the point of this table is
              which ministry to call. */}
          {data.byMinistry && data.byMinistry.length > 0 && (
            <section className="rounded-[1.75rem] border border-border bg-surface-raised p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)]">
              <h2 className="font-semibold text-primary">Ministry by ministry</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Turnout across published meetings, weakest first. Ministries
                with no invitations yet appear at the end.
              </p>

              <div className="mt-6 -mx-2 overflow-x-auto px-2">
                <table className="w-full min-w-[34rem] text-sm">
                  <caption className="sr-only">
                    Turnout, meetings and check-ins by ministry
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <th scope="col" className="px-2 py-2">
                        Ministry
                      </th>
                      <th scope="col" className="px-2 py-2 text-right">
                        Turnout
                      </th>
                      <th scope="col" className="px-2 py-2 text-right">
                        Meetings
                      </th>
                      <th scope="col" className="px-2 py-2 text-right">
                        Check-ins
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[...data.byMinistry]
                      .sort((a, b) => {
                        // Ministries with nothing to measure sink to the
                        // bottom rather than topping a "weakest first" list
                        // with a 0% they never had a chance to earn.
                        if (a.invited === 0 && b.invited === 0) return 0;
                        if (a.invited === 0) return 1;
                        if (b.invited === 0) return -1;
                        return a.attendanceRate - b.attendanceRate;
                      })
                      .map((m) => (
                        <tr key={m.ministryId}>
                          <th
                            scope="row"
                            className="px-2 py-3 text-left font-medium text-foreground"
                          >
                            {m.name}
                          </th>
                          <td className="px-2 py-3 text-right font-semibold text-primary">
                            {m.invited > 0 ? (
                              pct(m.attendanceRate)
                            ) : (
                              <span className="font-normal text-muted-foreground">
                                No invitations yet
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-3 text-right text-muted-foreground">
                            {m.meetings}
                          </td>
                          <td className="px-2 py-3 text-right text-muted-foreground">
                            {m.checkIns}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="rounded-[1.75rem] border border-border bg-surface-raised p-6 shadow-[0_8px_24px_rgba(0,53,128,0.06)]">
            <h2 className="font-semibold text-primary">Download the data</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Each file covers your whole ministry, not the figures above.
              Opens in Excel.
            </p>

            <div role="status" aria-live="polite" className="sr-only">
              {downloading ? 'Preparing your download' : ''}
            </div>

            {downloadError && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-alert-border bg-alert-bg p-3 text-sm text-alert-fg"
              >
                {downloadError}
              </p>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {/* Was a plain <a>. The Content-Disposition header is set by a
                  decorator, so a failure downloaded as a correctly-named CSV
                  containing the error sentence — filed, forwarded, and opened
                  a day later with no way back. apiDownload surfaces it here
                  instead, which is what its docblock asks for. */}
              {CSV_EXPORTS.map((e) => (
                <button
                  key={e.dataset}
                  type="button"
                  disabled={!!downloading}
                  onClick={() => void download(e.dataset, e.label)}
                  className="flex flex-col items-start gap-1 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary hover:bg-secondary disabled:opacity-60"
                >
                  <span className="flex items-center gap-2 font-medium text-primary">
                    <Download className="h-4 w-4 shrink-0" aria-hidden />
                    {downloading === e.dataset ? 'Preparing…' : e.label}
                  </span>
                  <span className="text-xs leading-snug text-muted-foreground">
                    {e.hint}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </PageContainer>
  );
}
