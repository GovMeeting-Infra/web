'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowUpRight, BellOff, CheckCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { ListSkeleton } from '@/components/ui/skeletons';
import type { Notification } from '@/lib/types/account';
import { PageContainer } from '@/components/ui/page-container';

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [isMarking, setIsMarking] = useState(false);

  const { data: notifications = [], isLoading, error: loadError } = useQuery({
    queryKey: ['notifications'],
    // includeRead so the page shows history, not just unread.
    queryFn: () =>
      apiFetch<Notification[]>('/api/v1/notifications?limit=50&includeRead=true'),
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    setIsMarking(true);
    setError(null);
    try {
      await apiFetch('/api/v1/notifications/mark-all-read', { method: 'PATCH' });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark all as read.');
    } finally {
      setIsMarking(false);
    }
  };

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-success">
            Inbox
          </p>
          <h1 className="text-3xl font-bold text-primary">Notifications</h1>
          <p className="mt-2 text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All read'}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={isMarking}
            className="flex items-center gap-2 rounded-[1.25rem] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" />
            {isMarking ? 'Marking…' : 'Mark all as read'}
          </button>
        )}
      </div>

      {(error || loadError) && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error ??
            (loadError instanceof Error
              ? loadError.message
              : 'Failed to load notifications')}
        </div>
      )}

      {isLoading && (
        <ListSkeleton rows={5} label="Loading notifications" />
      )}

      {!isLoading && notifications.length === 0 && (
        <div className="rounded-[1.5rem] border border-border bg-card p-12 text-center">
          <BellOff className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 font-medium text-foreground">No notifications yet</p>
        </div>
      )}

      {!isLoading && notifications.length > 0 && (
        <ul className="space-y-3">
          {notifications.map((n) => {
            const body = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    {!n.read && (
                      <span
                        aria-label="Unread"
                        className="h-2 w-2 shrink-0 rounded-full bg-primary"
                      />
                    )}
                    {n.title}
                  </p>
                  {n.link && (
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </div>
                {n.body && (
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </>
            );

            const cls = `block rounded-[1.5rem] border p-5 transition-colors ${
              n.read
                ? 'border-border bg-card'
                : 'border-primary/30 bg-[linear-gradient(180deg,#f4f8ff_0%,#edf3fd_100%)]'
            }`;

            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} className={`${cls} hover:border-primary/40`}>
                    {body}
                  </Link>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
