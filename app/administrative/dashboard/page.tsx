'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  AlertTriangle,
  ArrowRight,
  CalendarPlus,
  Building2,
  QrCode,
  RotateCw,
  ScanLine,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useCurrentUser } from '@/components/SessionProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCardsSkeleton, RowsSkeleton } from '@/components/ui/skeletons';
import type { MyProfile } from '@/lib/types/account';
import type { AnalyticsDashboard } from '@/lib/types/reports';
import { PageContainer } from '@/components/ui/page-container';
import { Tooltip } from '@/components/ui/tooltip';
import {
  isActionItemOverdue,
  ACTION_ITEM_STATUS_LABELS,
  type EventListResponse,
  type EventListItem,
  type BoardActionItem,
} from '@/lib/types/events';

/** Focus treatment for the bare links on this page. */
const FOCUS =
  '';

/**
 * Stat tints, by name rather than by hex.
 *
 * Each tint carries its own muted foreground at full opacity. The label and
 * hint used to be the card's own colour knocked back with opacity-80, which
 * put the gold and green cards at roughly 3.1:1 and 3.7:1 — and the gold card
 * is the one that says "N overdue".
 */
const STAT_TINTS = {
  blue: 'border-stat-blue-border bg-stat-blue-bg text-stat-blue-fg [--stat-muted:var(--color-stat-blue-muted)]',
  green:
    'border-stat-green-border bg-stat-green-bg text-stat-green-fg [--stat-muted:var(--color-stat-green-muted)]',
  violet:
    'border-stat-violet-border bg-stat-violet-bg text-stat-violet-fg [--stat-muted:var(--color-stat-violet-muted)]',
  gold: 'border-stat-gold-border bg-stat-gold-bg text-stat-gold-fg [--stat-muted:var(--color-stat-gold-muted)]',
} as const;

function StatCard({
  label,
  value,
  hint,
  icon,
  tint,
  href,
}: {
  label: string;
  value: number | null;
  hint?: string;
  icon: React.ReactNode;
  tint: keyof typeof STAT_TINTS;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-[1.5rem] border p-5 transition-transform hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${FOCUS} ${STAT_TINTS[tint]}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--stat-muted)]">
          {label}
        </p>
        {icon}
      </div>
      {/* An em dash, not 0, when the figure never arrived. Zero is a claim. */}
      <p className="mt-3 text-3xl font-bold">{value === null ? '—' : value}</p>
      {hint && <p className="mt-1 text-xs text-[var(--stat-muted)]">{hint}</p>}
    </Link>
  );
}

function MiniStat({
  label,
  value,
  hint,
  alert = false,
}: {
  label: string;
  value: number | string;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      {/* Hint lives inside the <dd>. As a sibling <p> it was invalid content
          for dl > div, which orphaned it from its own term for assistive tech. */}
      <dd>
        <span className="mt-1.5 block text-2xl font-bold text-foreground">
          {value}
        </span>
        {hint && (
          <span
            className={
              alert
                ? 'mt-0.5 flex items-center gap-1 text-xs font-medium text-alert-fg'
                : 'mt-0.5 block text-xs text-muted-foreground'
            }
          >
            {/* The red alone carried this state. Colour is never the only
                carrier — the rows further down already pair it with an icon. */}
            {alert && <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />}
            {hint}
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * What a panel shows when its request failed.
 *
 * Without this the catch-all was the empty state, so a dropped connection told
 * someone their day was clear. On this product that is the most expensive
 * sentence the interface can say.
 */
function PanelError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="p-8 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-alert-fg" aria-hidden />
      <p className="mt-3 text-sm font-medium text-foreground">{message}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        This is a connection problem, not an empty list.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={`mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-muted ${FOCUS}`}
      >
        <RotateCw className="h-4 w-4" aria-hidden /> Try again
      </button>
    </div>
  );
}

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function whenLabel(startAt: string, endAt: string) {
  const start = new Date(startAt);
  const now = new Date();
  const sameDay = start.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // End time too: a start alone doesn't tell an organizer whether they can take
  // the call after it.
  const span = `${timeOf(startAt)}–${timeOf(endAt)}`;

  if (sameDay) return `Today · ${span}`;
  if (start.toDateString() === tomorrow.toDateString())
    return `Tomorrow · ${span}`;
  return `${start.toLocaleDateString(undefined, { dateStyle: 'medium' })} · ${span}`;
}

function minutesSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function elapsedLabel(mins: number) {
  if (mins < 1) return 'just started';
  if (mins < 60) return `started ${mins} min ago`;
  const h = Math.floor(mins / 60);
  return `started ${h} hr${h === 1 ? '' : 's'} ago`;
}

function startsInLabel(mins: number) {
  if (mins <= 1) return 'starts in a moment';
  return `starts in ${mins} min`;
}

export default function DashboardPage() {
  const currentUser = useCurrentUser();

  const {
    data: profile,
    isLoading: loadingProfile,
    error: profileError,
  } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MyProfile>('/api/v1/me'),
  });

  // Happening right now, and mine. "Upcoming" is startAt > now server-side, so
  // a meeting drops out of that list at the moment it becomes the only thing
  // that matters — which is exactly when someone opens this page looking for
  // the check-in code.
  const {
    data: liveData,
    isLoading: loadingLive,
    refetch: refetchLive,
  } = useQuery({
    queryKey: ['dashboard-live'],
    queryFn: () =>
      apiFetch<EventListResponse>(
        '/api/v1/events?timeframe=now&mine=true&sortBy=startAt&order=asc',
      ),
    // The band goes stale on its own as a meeting starts or ends; nothing else
    // on the page would trigger a refetch while someone watches it.
    refetchInterval: 60_000,
  });

  const {
    data: upcoming,
    isLoading: loadingEvents,
    error: eventsError,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: ['dashboard-upcoming'],
    queryFn: () =>
      apiFetch<EventListResponse>(
        '/api/v1/events?timeframe=upcoming&mine=true&sortBy=startAt&order=asc',
      ),
  });

  // Only this person's work. The board itself is ministry-wide; a dashboard is
  // meant to answer "what do I need to do".
  const {
    data: myItems = [],
    isLoading: loadingItems,
    error: itemsError,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ['dashboard-action-items', currentUser?.id],
    queryFn: () =>
      apiFetch<BoardActionItem[]>(
        `/api/v1/action-items?owner=${encodeURIComponent(currentUser!.id)}`,
      ),
    enabled: !!currentUser?.id,
  });

  // The analytics endpoint is restricted to ministry-level roles, so this is
  // gated rather than merely hidden — asking as a staff member would 403.
  const isAdmin =
    !!currentUser &&
    ['SUPER_ADMIN', 'MINISTER', 'MINISTRY_ADMIN'].includes(
      currentUser.systemRole,
    );

  const { data: analytics, isLoading: loadingAnalytics } = useQuery({
    queryKey: ['dashboard-analytics'],
    queryFn: () => apiFetch<AnalyticsDashboard>('/api/v1/reports/analytics'),
    enabled: isAdmin,
  });

  const events: EventListItem[] = (upcoming?.data ?? []).slice(0, 5);
  const openItems = myItems.filter(
    (i) => i.status !== 'COMPLETED' && i.status !== 'CANCELLED',
  );
  const overdue = openItems
    .filter(isActionItemOverdue)
    .sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );
  // Ascending by due date, so the most overdue sits at the top.
  const soonest = [...openItems].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );
  const nextFive = soonest.slice(0, 5);

  const firstName = currentUser?.name?.split(' ')[0];

  // The band shows the single most urgent thing, and only falls back to a
  // greeting when there genuinely isn't one. A greeting is the least
  // informative thing on the page; it should not own its loudest element.
  const live = liveData?.data?.[0] ?? null;
  const imminent = !live
    ? (events.find((e) => {
        const mins = -minutesSince(e.startAt);
        return mins >= 0 && mins <= 60;
      }) ?? null)
    : null;
  const focusEvent = live ?? imminent;
  // Co-organizers can manage the code too, but the list payload doesn't carry
  // them — so the organizer gets the code directly and everyone else gets the
  // meeting, which is one click away from it and never 403s.
  const organizesFocus =
    !!focusEvent && focusEvent.organizer?.id === currentUser?.id;

  const statsUnavailable = !!profileError;
  const statValue = (n: number | undefined) =>
    statsUnavailable ? null : (n ?? 0);

  return (
    <PageContainer>
      <section className="overflow-hidden rounded-[1.75rem] border border-border bg-primary text-primary-foreground">
        {focusEvent ? (
          <div className="flex flex-wrap items-end justify-between gap-5 p-8 max-sm:p-5">
            <div className="min-w-0">
              <h1 className="text-sm font-medium text-primary-foreground/70">
                {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
              </h1>
              <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                <span
                  className={
                    live
                      ? 'h-2 w-2 rounded-full bg-accent motion-safe:animate-pulse'
                      : 'h-2 w-2 rounded-full bg-accent'
                  }
                  aria-hidden
                />
                {live
                  ? `Happening now · ${elapsedLabel(minutesSince(live.startAt))}`
                  : `Up next · ${startsInLabel(-minutesSince(imminent!.startAt))}`}
              </span>
              <h2 className="mt-2 text-3xl font-bold max-sm:text-2xl">
                {focusEvent.title}
              </h2>
              <p className="mt-2 text-primary-foreground/80">
                {timeOf(focusEvent.startAt)}–{timeOf(focusEvent.endAt)}
                {focusEvent.venueName ? ` · ${focusEvent.venueName}` : ''}
                {' · '}
                {focusEvent._count.attendances} of{' '}
                {focusEvent._count.attendees} checked in
              </p>
            </div>

            <Link
              href={
                organizesFocus
                  ? `/administrative/events/${focusEvent.id}/checkin-code`
                  : `/administrative/events/${focusEvent.id}`
              }
              className={`flex min-h-[2.75rem] items-center gap-2 rounded-[1.25rem] border border-white/40 bg-white px-5 py-2.5 font-semibold text-primary transition-colors hover:bg-white/90 ${FOCUS} on-dark`}
            >
              {organizesFocus ? (
                <>
                  <QrCode className="h-4 w-4" aria-hidden /> Open check-in code
                </>
              ) : (
                <>
                  <ScanLine className="h-4 w-4" aria-hidden /> Open meeting
                </>
              )}
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4 p-8 max-sm:p-5">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold max-sm:text-2xl">
                {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
              </h1>
              <p className="mt-2 max-w-xl text-primary-foreground/80">
                {loadingLive
                  ? 'Checking what you have on.'
                  : profile?.ministry
                    ? `Nothing running right now. Your meetings and actions across ${profile.ministry.name}.`
                    : 'Nothing running right now.'}
              </p>
            </div>

            <Tooltip content="Set the time, place and who is invited. The same form covers an internal meeting and a public activity.">
              <Link
                href="/administrative/events/new"
                className={`flex min-h-[2.75rem] items-center gap-2 rounded-[1.25rem] border border-white/40 bg-white/15 px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-white/25 ${FOCUS} on-dark`}
              >
                <CalendarPlus className="h-4 w-4" aria-hidden /> Schedule an
                activity
              </Link>
            </Tooltip>
          </div>
        )}
      </section>

      {/* Loss-framed and isolated. "Open actions 5 · 3 overdue" is accounting;
          this is the sentence that actually moves someone. Only rendered once
          its own query has settled, so it can never be a guess. */}
      {!loadingItems && overdue.length > 0 && (
        <section className="rounded-[1.5rem] border border-alert-border bg-alert-bg p-6 max-sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold text-alert-fg">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
              {overdue.length === 1
                ? '1 action is past its due date'
                : `${overdue.length} actions are past their due date`}
            </h2>
            <Link
              href={`/administrative/action-items?owner=${encodeURIComponent(currentUser?.id ?? '')}`}
              className={`flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-alert-fg underline-offset-4 hover:underline ${FOCUS}`}
            >
              Open the board <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {overdue.slice(0, 3).map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-alert-border/60 pb-2 last:border-0 last:pb-0"
              >
                <span className="min-w-0 font-medium text-foreground">
                  {item.title}
                </span>
                <span className="shrink-0 text-sm text-alert-fg">
                  Due{' '}
                  {new Date(item.dueDate).toLocaleDateString(undefined, {
                    dateStyle: 'medium',
                  })}
                </span>
              </li>
            ))}
          </ul>
          {overdue.length > 3 && (
            <p className="mt-3 text-sm text-alert-fg">
              and {overdue.length - 3} more.
            </p>
          )}
        </section>
      )}

      {loadingProfile ? (
        <StatCardsSkeleton />
      ) : (
        <div
          data-tour="dashboard-stats"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <StatCard
            label="Upcoming"
            value={statValue(profile?.stats.upcomingEvents)}
            hint="Meetings you're invited to"
            icon={<Clock className="h-5 w-5" aria-hidden />}
            tint="blue"
            href="/administrative/calendar"
          />
          <StatCard
            label="Organized"
            value={statValue(profile?.stats.organizedEvents)}
            hint="Meetings you run"
            icon={<CalendarDays className="h-5 w-5" aria-hidden />}
            tint="green"
            href="/administrative/events"
          />
          <StatCard
            label="Attended"
            value={statValue(profile?.stats.attendedEvents)}
            hint="Check-ins recorded"
            icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
            tint="violet"
            href="/administrative/profile"
          />
          <StatCard
            label="Open actions"
            value={statValue(profile?.stats.actionItems)}
            // Silent until its own query settles. This used to read "None
            // overdue" while the items were still in flight, so the page
            // asserted the reassuring answer before it knew one.
            hint={
              loadingItems || itemsError
                ? undefined
                : overdue.length > 0
                  ? `${overdue.length} overdue`
                  : 'None overdue'
            }
            icon={<ClipboardList className="h-5 w-5" aria-hidden />}
            tint="gold"
            href={`/administrative/action-items?owner=${encodeURIComponent(currentUser?.id ?? '')}`}
          />
        </div>
      )}

      {isAdmin && (
        <section className="rounded-[1.5rem] border border-border bg-card p-6 max-sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <Building2 className="h-5 w-5" aria-hidden />
              </span>
              <div>
                {/* Keyed off the role, not the response: scope only arrives
                    with the data, and a super admin has no ministry to name in
                    the meantime. */}
                <h2 className="font-semibold text-primary">
                  {currentUser?.systemRole === 'SUPER_ADMIN'
                    ? 'Across all ministries'
                    : `Across ${profile?.ministry?.name ?? 'your ministry'}`}
                </h2>
                {/* Was "Events from the last 30 days", which only ever
                    described the active-users tile. Everything else here is a
                    running total, and the figures are cached for an hour, so
                    both facts are now on the label. */}
                <p className="text-xs text-muted-foreground">
                  Running totals
                  {analytics?.generatedAt
                    ? ` · as of ${new Date(analytics.generatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
                    : ''}
                </p>
              </div>
            </div>
            <Link
              href="/administrative/reports"
              className={`flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-primary underline-offset-4 hover:underline ${FOCUS}`}
            >
              Full reports <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>

          {loadingAnalytics ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-muted/30 p-4"
                >
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="mt-2 h-7 w-12" />
                  <Skeleton className="mt-1 h-3 w-20" />
                </div>
              ))}
            </div>
          ) : !analytics ? (
            <p className="text-sm text-muted-foreground">
              Ministry figures are unavailable right now.
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <MiniStat
                label="Events"
                value={analytics.eventStats.total}
                hint={`${analytics.eventStats.upcoming} upcoming`}
              />
              <MiniStat
                label="Attendance"
                // The API returns a 0–1 rate, not a percentage. Clamped
                // because check-ins count walk-ins and guests while the
                // denominator counts invitees, so a well-attended public
                // activity can genuinely exceed its invite list.
                value={`${Math.min(100, Math.round(analytics.attendanceStats.attendanceRate * 100))}%`}
                hint={`${analytics.attendanceStats.totalCheckIns} check-ins`}
              />
              {/* The fifth tile the grid was already sized for. It had been
                  left empty since room booking was removed, while the one
                  figure that says whether the anti-proxy flow is working in
                  the room sat unread in the payload. */}
              <MiniStat
                label="Check-in method"
                value={
                  analytics.checkInMethods.total > 0
                    ? `${Math.round((analytics.checkInMethods.qr / analytics.checkInMethods.total) * 100)}%`
                    : '—'
                }
                hint={
                  analytics.checkInMethods.total > 0
                    ? `by QR · ${analytics.checkInMethods.manual} recorded by hand`
                    : 'No check-ins yet'
                }
              />
              <MiniStat
                label="Open actions"
                value={
                  analytics.actionItemStats.todo +
                  analytics.actionItemStats.inProgress
                }
                hint={
                  analytics.actionItemStats.overdue > 0
                    ? `${analytics.actionItemStats.overdue} overdue`
                    : 'None overdue'
                }
                alert={analytics.actionItemStats.overdue > 0}
              />
              <MiniStat
                label="Active users"
                value={analytics.userStats.activeUsers}
                hint={`of ${analytics.userStats.totalUsers}`}
              />
            </dl>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-[1.5rem] border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="font-semibold text-primary">Coming up</h2>
            <Link
              href="/administrative/calendar"
              className={`flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-primary underline-offset-4 hover:underline ${FOCUS}`}
            >
              Calendar <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>

          {loadingEvents ? (
            <RowsSkeleton rows={5} />
          ) : eventsError ? (
            <PanelError
              message="Couldn't load your meetings."
              onRetry={() => {
                void refetchEvents();
                void refetchLive();
              }}
            />
          ) : events.length === 0 ? (
            <div className="p-8 text-center">
              <CalendarDays
                className="mx-auto h-8 w-8 text-muted-foreground"
                aria-hidden
              />
              <p className="mt-3 text-sm font-medium text-foreground">
                Nothing scheduled
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Meetings you schedule or are invited to appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {events.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/administrative/events/${e.id}`}
                    className={`flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/40 ${FOCUS} focus-visible:-outline-offset-2`}
                  >
                    <div className="min-w-0">
                      {/* Wraps to two lines rather than truncating. At a 320px
                          reflow the old single line cut titles at roughly
                          twenty characters, which is mid-word for most of the
                          committee names this ministry actually uses. */}
                      <p className="line-clamp-2 font-medium break-words text-foreground">
                        {e.title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {whenLabel(e.startAt, e.endAt)}
                        {e.venueName ? ` · ${e.venueName}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground">
                        {e._count.attendees}{' '}
                        {e._count.attendees === 1 ? 'invitee' : 'invitees'}
                      </span>
                      {/* The two-calendar model is a product claim; a mixed
                          list that never says which is which erases it. */}
                      {e.isPublic && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] font-medium text-secondary-foreground">
                          Public
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[1.5rem] border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="font-semibold text-primary">Your action items</h2>
            <Link
              href={`/administrative/action-items?owner=${encodeURIComponent(currentUser?.id ?? '')}`}
              className={`flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-primary underline-offset-4 hover:underline ${FOCUS}`}
            >
              Board <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>

          {loadingItems ? (
            <RowsSkeleton rows={5} />
          ) : itemsError ? (
            <PanelError
              message="Couldn't load your action items."
              onRetry={() => void refetchItems()}
            />
          ) : nextFive.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2
                className="mx-auto h-8 w-8 text-muted-foreground"
                aria-hidden
              />
              <p className="mt-3 text-sm font-medium text-foreground">
                Nothing assigned to you
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Actions raised in minutes and given to you show up here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {nextFive.map((item) => {
                const late = isActionItemOverdue(item);
                return (
                  <li key={item.id}>
                    <Link
                      href={`/administrative/action-items?owner=${encodeURIComponent(currentUser?.id ?? '')}`}
                      className={`flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/40 ${FOCUS} focus-visible:-outline-offset-2`}
                    >
                      <div className="min-w-0">
                        <p className="line-clamp-2 font-medium break-words text-foreground">
                          {item.title}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                          {late && (
                            <AlertTriangle
                              className="h-3 w-3 shrink-0 text-alert-fg"
                              aria-hidden
                            />
                          )}
                          <span className={late ? 'text-alert-fg' : ''}>
                            Due{' '}
                            {new Date(item.dueDate).toLocaleDateString(
                              undefined,
                              { dateStyle: 'medium' },
                            )}
                            {late ? ' · overdue' : ''}
                          </span>
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {ACTION_ITEM_STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
