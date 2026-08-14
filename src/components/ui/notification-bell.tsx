'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, ArrowUpRight } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { Skeleton } from './skeleton';
import type { Notification } from '@/lib/types/account';

const PREVIEW_LIMIT = 6;

function ago(value: string): string {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * The bell in the top bar.
 *
 * Opens a panel of unread notifications rather than navigating — the full
 * history, read and unread, lives on the Notifications page in the sidebar.
 */
export function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Unread only. includeRead is deliberately absent — the page covers history.
  const { data: unread = [], isLoading } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () =>
      apiFetch<Notification[]>(`/api/v1/notifications?limit=${PREVIEW_LIMIT}`),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/api/v1/notifications/${id}/read`, { method: 'PATCH' });
      refresh();
    } catch {
      // Reading is a convenience; a failure here should not interrupt whatever
      // the person was actually doing.
    }
  };

  const markAllRead = async () => {
    try {
      await apiFetch('/api/v1/notifications/mark-all-read', { method: 'PATCH' });
      refresh();
    } catch {
      /* as above */
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          unread.length ? `Notifications, ${unread.length} unread` : 'Notifications'
        }
        aria-expanded={open}
        aria-haspopup="menu"
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-muted"
      >
        <Bell className="h-5 w-5 text-foreground" />
        {unread.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          // Width clamps so the panel cannot reach past the left edge on a
          // narrow phone. 5rem, not 2rem: the bell is not the last thing in the
          // header — the flag chip and user menu sit to its right — so the
          // panel's right edge starts about 4rem in, and a 2rem allowance put
          // its left edge off-screen at 375px, where the column's
          // overflow-hidden quietly clipped it. The height cap matters more:
          // header, six items and the footer run past a landscape phone's
          // ~390px, and the list's own max-h does not cover that chrome, so
          // "See all" became unreachable.
          className="absolute right-0 z-50 mt-2 max-h-[calc(100dvh-6rem)] w-[min(20rem,calc(100vw-5rem))] overflow-y-auto overflow-x-hidden rounded-[1.25rem] border border-border bg-card shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-primary">Unread</h2>
            {unread.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs font-medium text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {isLoading ? (
            <div role="status" aria-live="polite" className="divide-y divide-border">
              <span className="sr-only">Loading notifications</span>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2 px-4 py-3">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              ))}
            </div>
          ) : unread.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <BellOff className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Nothing unread
              </p>
            </div>
          ) : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {unread.map((n) => {
                const body = (
                  <>
                    <p className="text-sm font-medium text-foreground">
                      {n.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {ago(n.createdAt)}
                    </p>
                  </>
                );

                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => {
                          markRead(n.id);
                          setOpen(false);
                        }}
                        className="block px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        {body}
                      </Link>
                    ) : (
                      <button
                        onClick={() => markRead(n.id)}
                        className="block w-full px-4 py-3 text-left transition-colors hover:bg-muted/50"
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            href="/administrative/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1 border-t border-border px-4 py-3 text-xs font-medium text-primary hover:bg-muted/40"
          >
            See all notifications <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
