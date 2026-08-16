'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, ArrowUpRight } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { Skeleton } from './skeleton';
import type { Notification } from '@/lib/types/account';
import { Tooltip } from './tooltip';

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
  // The endpoint returns a page object now, so the list is under `items`.
  const { data: unreadPage, isLoading } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () =>
      apiFetch<{ items: Notification[]; total: number }>(
        `/api/v1/notifications?limit=${PREVIEW_LIMIT}`,
      ),
    refetchInterval: 60_000,
  });

  const unread = unreadPage?.items ?? [];

  // The real total, separate from the preview. The badge used to count the
  // preview array, which is capped at PREVIEW_LIMIT — so it stopped at 6 no
  // matter how many were waiting, and said so out loud to screen readers.
  const { data: counts } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => apiFetch<{ unread: number }>('/api/v1/notifications/unread-count'),
    refetchInterval: 60_000,
  });

  // Falls back to the preview length while the count is in flight, so the badge
  // never blinks out on a slow connection.
  const unreadTotal = counts?.unread ?? unread.length;

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
    queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
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
      {/* Suppressed while the panel is open, or the hint would float over the
          thing it describes. */}
      <Tooltip
        disabled={open}
        content={
          unread.length
            ? `${unread.length} unread — meetings, minutes and anything assigned to you`
            : 'Meetings, minutes and anything assigned to you'
        }
      >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          unreadTotal ? `Notifications, ${unreadTotal} unread` : 'Notifications'
        }
        aria-expanded={open}
        aria-haspopup="menu"
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-muted"
      >
        <Bell className="h-5 w-5 text-foreground" />
        {unreadTotal > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unreadTotal > 9 ? '9+' : unreadTotal}
          </span>
        )}
      </button>
      </Tooltip>

      {open && (
        <div
          role="menu"
          // Below sm the panel is pinned to the viewport rather than hung off
          // the bell. Anchoring it to the trigger meant its left edge was
          // whatever was left after the header padding, the user menu and the
          // gaps — about 74px in — so the width had to be clamped to
          // 100vw-5rem just to stay on screen, and that left ~6px of clearance
          // at 375px. Any change to the header's right-hand group ate it. Now
          // it simply spans the screen with an even 1rem margin, and the
          // arithmetic cannot drift.
          //
          // top-[4.5rem] clears the h-16 header plus the gap the mt-2 used to
          // provide. From sm it goes back to hanging off the bell, where there
          // is room for it.
          //
          // The height cap stays: header, six items and the footer run past a
          // landscape phone's ~390px, and the list's own max-h does not cover
          // that chrome, so "See all" became unreachable without it.
          className="fixed inset-x-4 top-[4.5rem] z-50 max-h-[calc(100dvh-6rem)] overflow-y-auto overflow-x-hidden rounded-[1.25rem] border border-border bg-card shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80"
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
