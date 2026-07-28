'use client';

import { Menu, Building2, Search } from 'lucide-react';
import { SierraLeoneFlag } from '../SierraLeoneFlag';
import { NotificationBell } from './notification-bell';
import { UserMenu } from './user-menu';

interface TopbarProps {
  ministryName?: string;
  userName?: string;
  userEmail?: string;
}

export function Topbar({ ministryName, userName, userEmail }: TopbarProps) {
  return (
    <header className="relative flex h-20 flex-shrink-0 items-center justify-between border-b border-color-border bg-[#f8fbff] px-6">
      <button
        id="mobile-menu-button"
        className="mr-4 hidden items-center justify-center rounded-xl border border-color-border bg-color-card p-2 transition-colors hover:bg-color-muted sm:hidden"
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-6">
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

        {/* Global search. A plain GET form so it works without JS and lands on
            /administrative/search?q=… exactly as a shared link would. */}
        <form
          action="/administrative/search"
          method="GET"
          role="search"
          className="relative hidden min-w-0 max-w-sm flex-1 md:block"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            name="q"
            placeholder="Search events, minutes, rooms…"
            aria-label="Search"
            className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </form>
      </div>

      <div className="flex items-center gap-3">
        {/* Opens a panel of unread items rather than navigating; the full
            history lives on the Notifications page in the sidebar. */}
        <NotificationBell />

        <SierraLeoneFlag className="hidden h-8 w-14 sm:inline-flex" />

        {/* Opens an account menu rather than jumping straight to the profile:
            it is also where people look for who they are signed in as, and for
            the way out. */}
        <UserMenu userName={userName} userEmail={userEmail} />
      </div>
    </header>
  );
}
