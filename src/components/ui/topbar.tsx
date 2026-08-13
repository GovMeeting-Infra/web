'use client';

import { Menu, Building2, Search } from 'lucide-react';
import Link from 'next/link';
import { SierraLeoneFlag } from '../SierraLeoneFlag';
import { NotificationBell } from './notification-bell';
import { UserMenu } from './user-menu';

interface TopbarProps {
  ministryName?: string;
  userName?: string;
  userEmail?: string;
  /** Whether the mobile nav drawer is open, for aria-expanded. */
  menuOpen?: boolean;
  onMenuClick?: () => void;
}

export function Topbar({
  ministryName,
  userName,
  userEmail,
  menuOpen = false,
  onMenuClick,
}: TopbarProps) {
  return (
    <header className="relative flex h-16 flex-shrink-0 items-center justify-between border-b border-border bg-[#f8fbff] px-4 sm:h-20 sm:px-6">
      {/* The only way to the sidebar below lg, where it is display:none. */}
      <button
        type="button"
        id="mobile-menu-button"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        aria-expanded={menuOpen}
        aria-controls="mobile-nav-drawer"
        className="mr-2 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-muted lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6">
        {ministryName && (
          <div className="hidden flex-shrink-0 items-center gap-3 sm:flex">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-semibold text-foreground">
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

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Stands in for the search form above, which hides at the same
            breakpoint. Without it the Search page has no door on a phone. */}
        <Link
          href="/administrative/search"
          aria-label="Search"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted md:hidden"
        >
          <Search className="h-5 w-5" />
        </Link>

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
