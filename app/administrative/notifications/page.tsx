'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowUpRight,
  CheckCheck,
  CheckCircle2,
  CalendarDays,
  CalendarX2,
  CalendarClock,
  AlarmClock,
  ClipboardList,
  ClipboardCheck,
  FileText,
  ListChecks,
} from 'lucide-react';
import { apiFetch, messageFor } from '@/lib/api/client';
import { ListSkeleton } from '@/components/ui/skeletons';
import type {
  Notification,
  NotificationPage,
  NotificationType,
} from '@/lib/types/account';
import { PageContainer } from '@/components/ui/page-container';

const PAGE_SIZE = 25;

/**
 * How each kind of notification looks, and how loudly.
 *
 * The server has always sent `type` and the page always threw it away, so nine
 * kinds of obligation — a meeting starting within the hour, a weekly digest —
 * rendered as identical cards. When everything is equally loud, people stop
 * reading any of it.
 *
 * `weight` decides that loudness: `urgent` is for the two things with a cost
 * attached to missing them, and `quiet` is for the digest, which is a summary
 * of things you have already been told.
 */
const KINDS: Record<
  NotificationType,
  {
    label: string;
    icon: React.ReactNode;
    tint: string;
    weight: 'urgent' | 'normal' | 'quiet';
  }
> = {
  MEETING_REMINDER: {
    label: 'Starting soon',
    icon: <AlarmClock className="h-4 w-4" />,
    tint: 'border-alert-border bg-alert-bg text-alert-fg',
    weight: 'urgent',
  },
  MEETING_CANCELLED: {
    label: 'Cancelled',
    icon: <CalendarX2 className="h-4 w-4" />,
    tint: 'border-alert-border bg-alert-bg text-alert-fg',
    weight: 'urgent',
  },
  MEETING_CHANGED: {
    label: 'Changed',
    icon: <CalendarClock className="h-4 w-4" />,
    tint: 'border-stat-gold-border bg-stat-gold-bg text-stat-gold-fg',
    weight: 'normal',
  },
  MEETING_INVITATION: {
    label: 'Invitation',
    icon: <CalendarDays className="h-4 w-4" />,
    tint: 'border-stat-blue-border bg-stat-blue-bg text-stat-blue-fg',
    weight: 'normal',
  },
  ACTION_ITEM_ASSIGNED: {
    label: 'Assigned to you',
    icon: <ClipboardList className="h-4 w-4" />,
    tint: 'border-stat-blue-border bg-stat-blue-bg text-stat-blue-fg',
    weight: 'normal',
  },
  ACTION_ITEM_DUE_SOON: {
    label: 'Due today',
    icon: <ClipboardCheck className="h-4 w-4" />,
    tint: 'border-stat-gold-border bg-stat-gold-bg text-stat-gold-fg',
    weight: 'urgent',
  },
  ACTION_ITEM_STATUS_CHANGED: {
    label: 'Updated',
    icon: <ListChecks className="h-4 w-4" />,
    tint: 'border-stat-violet-border bg-stat-violet-bg text-stat-violet-fg',
    weight: 'normal',
  },
  ACTION_ITEM_WEEKLY_DIGEST: {
    label: 'Weekly summary',
    icon: <ListChecks className="h-4 w-4" />,
    tint: 'border-border bg-muted text-muted-foreground',
    weight: 'quiet',
  },
  MINUTES_PUBLISHED: {
    label: 'Minutes',
    icon: <FileText className="h-4 w-4" />,
    tint: 'border-stat-green-border bg-stat-green-bg text-stat-green-fg',
    weight: 'normal',
  },
};

const FALLBACK_KIND = {
  label: 'Notice',
  icon: <FileText className="h-4 w-4" />,
  tint: 'border-border bg-muted text-muted-foreground',
  weight: 'normal' as const,
};

const kindOf = (type: NotificationType) => KINDS[type] ?? FALLBACK_KIND;

/** The filters offered above the list, in triage order. */
const FILTERS = [
  { key: 'all', label: 'Everything' },
  { key: 'unread', label: 'Unread' },
  { key: 'meetings', label: 'Meetings' },
  { key: 'actions', label: 'Action items' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

function matchesFilter(n: Notification, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  if (filter === 'unread') return !n.read;
  if (filter === 'meetings') return n.type.startsWith('MEETING_');
  return n.type.startsWith('ACTION_ITEM_') || n.type === 'MINUTES_PUBLISHED';
}

/**
 * Recent times as an interval, older ones as a date.
 *
 * Every row carried a full "16 Aug 2026, 09:14" — nineteen characters of low
 * information repeated down a phone screen, when what someone triaging wants to
 * know is whether a thing is from this morning or last month.
 */
function whenText(iso: string): string {
  const then = new Date(iso);
  const minutes = Math.round((Date.now() - then.getTime()) / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / (60 * 24))}d ago`;
  return then.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [isMarking, setIsMarking] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const {
    data: page,
    isLoading,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey: ['notifications', limit],
    queryFn: () =>
      apiFetch<NotificationPage>(
        `/api/v1/notifications?limit=${limit}&includeRead=true`,
      ),
  });

  /**
   * The badge's number, from the same query the bell uses.
   *
   * It used to be counted from the rows on screen, which are capped — so
   * someone whose recent notifications were all read saw "All read" in the
   * largest type on the page while the bell beside it said 15.
   */
  const { data: counts } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () =>
      apiFetch<{ unread: number }>('/api/v1/notifications/unread-count'),
  });

  const notifications = page?.items ?? [];
  const total = page?.total ?? 0;
  const unreadCount = counts?.unread ?? notifications.filter((n) => !n.read).length;
  const visible = notifications.filter((n) => matchesFilter(n, filter));

  /** Both of the bell's keys as well as our own — it does the same for us. */
  const refreshEverywhere = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
  };

  /**
   * Mark one as read, optimistically.
   *
   * Reading a notification here never used to clear it, so the only way to
   * discharge the badge was the all-or-nothing button — which is what teaches
   * people to stop trusting the number. Optimistic because the row is usually
   * about to unmount under a navigation, and waiting for a round trip would
   * mean the change never visibly lands.
   */
  const markRead = (id: string) => {
    queryClient.setQueryData<NotificationPage>(['notifications', limit], (old) =>
      old
        ? {
            ...old,
            items: old.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
          }
        : old,
    );

    apiFetch(`/api/v1/notifications/${id}/read`, { method: 'PATCH' })
      .then(refreshEverywhere)
      .catch(() => {
        // Put it back. Silent otherwise: the person is mid-navigation and an
        // error banner about a read receipt would be noise, but leaving the row
        // falsely cleared would quietly lose them the thing.
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      });
  };

  const markAllRead = async () => {
    setIsMarking(true);
    setError(null);
    try {
      await apiFetch('/api/v1/notifications/mark-all-read', { method: 'PATCH' });
      refreshEverywhere();
    } catch (err) {
      setError(
        messageFor(err, "Couldn't mark everything as read. Try again."),
      );
    } finally {
      setIsMarking(false);
    }
  };

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">Notifications</h1>
          <p className="mt-2 text-muted-foreground" role="status" aria-live="polite">
            {unreadCount > 0
              ? `${unreadCount} waiting`
              : total > 0
                ? 'Nothing waiting'
                : ''}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={isMarking}
            className="flex items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            {/* Names the true scope. It clears every unread notification on the
                account, including ones below the rows currently loaded. */}
            {isMarking ? 'Marking all read…' : `Mark all ${unreadCount} as read`}
          </button>
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

      {loadError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <p>{messageFor(loadError, "Couldn't load your notifications.")}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-md border border-destructive/30 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-destructive/10"
          >
            Try again
          </button>
        </div>
      )}

      {isLoading && <ListSkeleton rows={5} label="Loading notifications" />}

      {!isLoading && !loadError && total === 0 && (
        <div className="rounded-[1.5rem] border border-border bg-card p-12 text-center">
          {/* Not a crossed-out bell. That icon means "notifications are off"
              everywhere else, and here they cannot be turned off at all — so it
              told people the opposite of the truth at the one moment the page
              had nothing else to say. */}
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden="true" />
          <p className="mt-4 font-medium text-foreground">You are all caught up</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Anything you are expected at or answerable for lands here — meeting
            invitations, changes, minutes, and work assigned to you.
          </p>
        </div>
      )}

      {!isLoading && total > 0 && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter notifications">
            {FILTERS.map((f) => {
              const isOn = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  aria-pressed={isOn}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                    isOn
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {visible.length === 0 ? (
            <div className="rounded-[1.5rem] border border-border bg-card p-10 text-center">
              <p className="text-sm text-muted-foreground">
                Nothing here under {FILTERS.find((f) => f.key === filter)?.label}.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {visible.map((n) => {
                const kind = kindOf(n.type);

                const body = (
                  <>
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${kind.tint}`}
                      >
                        {kind.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p
                            className={`text-foreground ${
                              n.read ? 'font-normal' : 'font-semibold'
                            }`}
                          >
                            {/* Real text, not an aria-label on a bare span —
                                which has no role, so most screen readers drop
                                it and the state was announced to nobody. */}
                            {!n.read && <span className="sr-only">Unread. </span>}
                            {n.title}
                          </p>
                          {n.link && (
                            <ArrowUpRight
                              aria-hidden="true"
                              className="h-4 w-4 shrink-0 text-muted-foreground"
                            />
                          )}
                        </div>
                        {n.body && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          <span>{kind.label}</span>
                          <span aria-hidden="true">·</span>
                          <time dateTime={n.createdAt}>{whenText(n.createdAt)}</time>
                        </p>
                      </div>
                    </div>
                  </>
                );

                // Weight, not just colour: an urgent unread row gets the ring,
                // a quiet one never does however unread it is.
                const emphasis = n.read
                  ? 'border-border bg-card'
                  : kind.weight === 'urgent'
                    ? 'border-alert-border bg-alert-bg'
                    : kind.weight === 'quiet'
                      ? 'border-border bg-card'
                      : 'border-stat-blue-border bg-stat-blue-bg';

                const cls = `block rounded-[1.5rem] border p-5 transition-colors ${emphasis}`;

                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => {
                          if (!n.read) markRead(n.id);
                        }}
                        className={`${cls} hover:border-primary/40`}
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className={cls}>{body}</div>
                    )}
                    {!n.read && (
                      <div className="mt-1 flex justify-end">
                        {/* So an item already dealt with elsewhere can be
                            cleared without opening it. */}
                        <button
                          type="button"
                          onClick={() => markRead(n.id)}
                          className="rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
                        >
                          Mark as read
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Showing {visible.length} of {total}
            </p>
            {notifications.length < total && (
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE_SIZE)}
                className="mt-3 rounded-[1.25rem] border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
              >
                Load older
              </button>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}
