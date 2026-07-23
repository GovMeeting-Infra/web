'use client';

import { Menu, Bell, Building2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

interface TopbarProps {
  ministryName?: string;
  userName?: string;
  userEmail?: string;
}

export function Topbar({ ministryName, userName, userEmail }: TopbarProps) {
  const initial = (userName ?? userEmail ?? 'U').charAt(0).toUpperCase();

  return (
    <header className="relative flex h-20 flex-shrink-0 items-center justify-between border-b border-color-border bg-[#f8fbff] px-6">
      <button
        id="mobile-menu-button"
        className="mr-4 hidden items-center justify-center rounded-xl border border-color-border bg-color-card p-2 transition-colors hover:bg-color-muted sm:hidden"
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex flex-1 items-center gap-6">
        {ministryName && (
          <div className="hidden flex-shrink-0 items-center gap-3 sm:flex">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-color-secondary text-color-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-semibold text-color-foreground">
                {ministryName}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-color-border bg-color-card transition-colors hover:bg-color-muted"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-color-foreground" />
        </button>

        <Link
          href="/administrative/profile"
          className="flex items-center rounded-full border border-color-border bg-color-card p-1 transition-colors hover:bg-color-muted"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-color-primary text-xs font-bold text-white">
            {initial}
          </div>
        </Link>
      </div>
    </header>
  );
}
