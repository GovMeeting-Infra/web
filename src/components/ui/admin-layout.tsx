'use client';

import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { MobileNavDrawer } from './mobile-nav-drawer';
import { SidebarNav } from './sidebar-nav';
import { Topbar } from './topbar';
import { Tooltip } from './tooltip';

interface AdminLayoutProps {
  children: ReactNode;
  ministryName?: string;
  userName?: string;
  userEmail?: string;
  /** The viewer's compact-mode preference. */
  compact?: boolean;
}

export function AdminLayout({
  children,
  ministryName,
  userName,
  userEmail,
  compact = false,
}: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    // data-density drives the compact-mode rules in globals.css, which tighten
    // spacing without every page having to know about the preference.
    <div
      className="flex h-dvh bg-background"
      data-density={compact ? 'compact' : undefined}
    >
      {/* Sidebar. Appears at lg rather than sm because it costs 288px: at the
          768px of an iPad in portrait that would leave a 416px content column
          — narrower than a large phone — for tables that ask for 896px. Below
          lg, MobileNavDrawer stands in for it. */}
      <aside
        className={cn(
          'relative hidden h-dvh flex-shrink-0 flex-col overflow-visible border-r border-sidebar-border bg-[linear-gradient(180deg,#f7fbff_0%,#f1f7fe_100%)] transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex',
          collapsed ? 'w-20' : 'w-72',
        )}
      >
        {/* Collapse Button */}
        <Tooltip
          side="right"
          content={
            collapsed
              ? 'Widen the sidebar to show labels beside each icon'
              : 'Narrow the sidebar to icons only, for more room on the page'
          }
        >
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute right-[-1px] top-24 z-30 hidden h-16 w-10 translate-x-[48%] items-center justify-center rounded-r-[999px] rounded-l-none border border-l-0 border-[#cfdced] bg-[linear-gradient(180deg,#fafdff_0%,#eef4fc_100%)] shadow-[10px_14px_30px_rgba(0,53,128,0.10)] transition-all duration-300 hover:bg-[linear-gradient(180deg,#ffffff_0%,#f2f7ff_100%)] lg:flex"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-primary shadow-[0_8px_18px_rgba(0,53,128,0.16)] ring-1 ring-[#d7e3f1] transition-transform duration-300">
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </span>
        </button>
        </Tooltip>

        {/* Logo Section */}
        <div
          className={cn(
            'border-b border-sidebar-border py-5 transition-[padding] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]',
            collapsed ? 'px-4' : 'px-5',
          )}
        >
          <div className="flex items-start justify-between gap-3 overflow-hidden">
            <div className="flex min-w-0 flex-1 items-center overflow-hidden">
              <div className="flex h-12 w-12 items-center justify-center flex-shrink-0">
                <Image
                  src="/coat_of_arms.jpeg"
                  alt="Sierra Leone coat of arms"
                  width={44}
                  height={44}
                  className="h-11 w-11 object-contain"
                />
              </div>
              <div
                className={cn(
                  'min-w-0 overflow-hidden pl-3.5 transition-[max-width,opacity,transform,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
                  collapsed
                    ? 'max-w-0 translate-x-2 opacity-0 pl-0'
                    : 'max-w-[13rem] translate-x-0 opacity-100',
                )}
              >
                <div className="min-w-0 space-y-1">
                  <span className="block text-[19px] font-semibold leading-none tracking-[-0.02em] text-sidebar-foreground">
                    GovMeeting
                  </span>
                  <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-sidebar-primary/80">
                    Government of Sierra Leone
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <SidebarNav collapsed={collapsed} />
      </aside>

      {/* Main Content. min-w-0 lets this flex child shrink below its content
          width — without it a wide page pushes the whole layout sideways
          instead of scrolling or wrapping inside the content area. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <Topbar
          ministryName={ministryName}
          userName={userName}
          userEmail={userEmail}
          menuOpen={mobileNavOpen}
          onMenuClick={() => setMobileNavOpen(true)}
        />

        {/* Page Content */}
        {/* A flex column all the way down, so a page can opt into filling the
            viewport with flex-1 and push a trailing section to the bottom.
            Deliberately not min-h-full: a percentage height needs a definite
            height on the parent, and this wrapper's is content-driven, so it
            resolved to nothing. flex-1 has no such dependency, and still lets
            taller content grow past the viewport and scroll. */}
        <main className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
          <div className="flex min-w-0 flex-1 flex-col bg-background">
            {children}
          </div>
        </main>
      </div>

      {/* Last, so it paints over the shell without needing to out-stack the
          topbar. Mounts only while open, so desktop renders exactly as before. */}
      <MobileNavDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        ministryName={ministryName}
      />
    </div>
  );
}
