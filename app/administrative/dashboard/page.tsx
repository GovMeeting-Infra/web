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
} from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useCurrentUser } from '@/components/SessionProvider';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCardsSkeleton, RowsSkeleton } from '@/components/ui/skeletons';
import type { MyProfile } from '@/lib/types/account';
import type { AnalyticsDashboard } from '@/lib/types/reports';
import { PageContainer } from '@/components/ui/page-container';
import {
  isActionItemOverdue,
  ACTION_ITEM_STATUS_LABELS,
  type EventListResponse,
  type EventListItem,
  type BoardActionItem,
} from '@/lib/types/events';

function StatCard({
  label,
  value,
  hint,
  icon,
  tint,
  href,
}: {
  label: string;
  value: number;
  hint?: string;
  icon: React.ReactNode;
  tint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-[1.5rem] border p-5 transition-transform hover:-translate-y-0.5 ${tint}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
          {label}
        </p>
        {icon}
      </div>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs opacity-80">{hint}</p>}
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
      <dd className="mt-1.5 text-2xl font-bold text-foreground">{value}</dd>
      {hint && (
        <p
          className={`mt-0.5 text-xs ${alert ? 'font-medium text-destructive' : 'text-muted-foreground'}`}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function whenLabel(startAt: string) {
  const start = new Date(startAt);
  const now = new Date();
  const sameDay = start.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const time = start.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (sameDay) return `Today · ${time}`;
  if (start.toDateString() === tomorrow.toDateString())
    return `Tomorrow · ${time}`;
  return `${start.toLocaleDateString(undefined, { dateStyle: 'medium' })} · ${time}`;
}

export default function DashboardPage() {
  const currentUser = useCurrentUser();

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MyProfile>('/api/v1/me'),
  });

  const { data: upcoming, isLoading: loadingEvents } = useQuery({
    queryKey: ['dashboard-upcoming'],
    queryFn: () =>
      apiFetch<EventListResponse>(
        '/api/v1/events?timeframe=upcoming&sortBy=startAt&order=asc',
      ),
  });

  // Only this person's work. The board itself is ministry-wide; a dashboard is
  // meant to answer "what do I need to do".
  const { data: myItems = [], isLoading: loadingItems } = useQuery({
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
  const overdue = openItems.filter(isActionItemOverdue);
  const dueSoon = [...openItems]
    .sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    )
    .slice(0, 5);

  const firstName = currentUser?.name?.split(' ')[0];

  return (
    <PageContainer>
      <section className="overflow-hidden rounded-[1.75rem] border border-border bg-primary text-primary-foreground">
        <div className="flex flex-wrap items-center justify-between gap-4 p-8 max-sm:p-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-foreground/70">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
            </h1>
            <p className="mt-2 max-w-xl text-primary-foreground/80">
              {profile?.ministry
                ? `Your meetings and actions across ${profile.ministry.name}.`
                : 'Your meetings and actions.'}
            </p>
          </div>

          <Link
            href="/administrative/events/new"
            className="flex items-center gap-2 rounded-[1.25rem] bg-white/15 px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-white/25"
          >
            <CalendarPlus className="h-4 w-4" /> Schedule a meeting
          </Link>
        </div>
      </section>

      {loadingProfile ? (
        <StatCardsSkeleton />
      ) : (
        <div
          data-tour="dashboard-stats"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <StatCard
            label="Upcoming"
            value={profile?.stats.upcomingEvents ?? 0}
            hint="Meetings you're invited to"
            icon={<Clock className="h-5 w-5 opacity-70" />}
            tint="border-[#c9d9f2] bg-[#edf3fd] text-[#003580]"
            href="/administrative/calendar"
          />
          <StatCard
            label="Organized"
            value={profile?.stats.organizedEvents ?? 0}
            hint="Meetings you run"
            icon={<CalendarDays className="h-5 w-5 opacity-70" />}
            tint="border-[#cfe5d7] bg-[#edf8f1] text-[#007236]"
            href="/administrative/events"
          />
          <StatCard
            label="Attended"
            value={profile?.stats.attendedEvents ?? 0}
            hint="Check-ins recorded"
            icon={<CheckCircle2 className="h-5 w-5 opacity-70" />}
            tint="border-[#d9cff2] bg-[#f3effd] text-[#4c1d95]"
            href="/administrative/profile"
          />
          <StatCard
            label="Open actions"
            value={profile?.stats.actionItems ?? 0}
            hint={
              overdue.length > 0 ? `${overdue.length} overdue` : 'None overdue'
            }
            icon={<ClipboardList className="h-5 w-5 opacity-70" />}
            tint="border-[#fde8a6] bg-[#fff8e5] text-[#8d6400]"
            href="/administrative/action-items"
          />
        </div>
      )}

      {isAdmin && (
        <section className="rounded-[1.5rem] border border-border bg-card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary">
                <Building2 className="h-5 w-5" />
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
                <p className="text-xs text-muted-foreground">
                  Events from the last 30 days
                </p>
              </div>
            </div>
            <Link
              href="/administrative/reports"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Full reports <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {loadingAnalytics ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border bg-muted/30 p-4">
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
                // The API returns a 0–1 rate, not a percentage.
                value={`${Math.round(analytics.attendanceStats.attendanceRate * 100)}%`}
                hint={`${analytics.attendanceStats.totalCheckIns} check-ins`}
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
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Calendar <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {loadingEvents ? (
            <RowsSkeleton />
          ) : events.length === 0 ? (
            <div className="p-8 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
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
                    className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {e.title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {whenLabel(e.startAt)}
                        {e.venueName ? ` · ${e.venueName}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {e._count.attendees}{' '}
                      {e._count.attendees === 1 ? 'invitee' : 'invitees'}
                    </span>
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
              href="/administrative/action-items"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Board <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {loadingItems ? (
            <RowsSkeleton />
          ) : dueSoon.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">
                Nothing assigned to you
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Actions raised in minutes and given to you show up here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {dueSoon.map((item) => {
                const late = isActionItemOverdue(item);
                return (
                  <li key={item.id}>
                    <Link
                      href="/administrative/action-items"
                      className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {item.title}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                          {late && (
                            <AlertTriangle className="h-3 w-3 text-destructive" />
                          )}
                          <span className={late ? 'text-destructive' : ''}>
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
