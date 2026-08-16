'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  CalendarRange,
  Users,
  UserCircle,
  HelpCircle,
  LayoutDashboard,
  CalendarDays,
  KanbanSquare,
  ClipboardList,
  BarChart3,
  Building2,
  Bell,
  ScrollText,
  SlidersHorizontal,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useCurrentUser } from '@/components/SessionProvider';
import { ADMIN_ROLES } from '@/lib/roles';
import { signOut } from '@/lib/sign-out';
import { Tooltip } from './tooltip';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** When set, only these roles see the entry. */
  roles?: string[];
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * Grouped by what the destinations have to do with each other: scheduling a
 * meeting, the records it produces, oversight of both, and your own account.
 *
 * Every restricted entry mirrors its page guard. Getting that wrong is not
 * cosmetic — an entry offered to someone the page refuses sends them to
 * /forbidden, which is how Users and Reports behaved before.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        href: '/administrative/dashboard',
        label: 'Dashboard',
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
    ],
  },
  {
    title: 'Meetings',
    items: [
      {
        href: '/administrative/events',
        label: 'Events',
        icon: <CalendarDays className="h-4 w-4" />,
      },
      {
        href: '/administrative/calendar',
        label: 'Calendar',
        icon: <CalendarRange className="h-4 w-4" />,
      },
    ],
  },
  {
    title: 'Records',
    items: [
      {
        href: '/administrative/minutes',
        label: 'Minutes',
        icon: <ClipboardList className="h-4 w-4" />,
      },
      {
        href: '/administrative/action-items',
        label: 'Action Items',
        icon: <KanbanSquare className="h-4 w-4" />,
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        // requireRole(ADMIN_ROLES) in app/administrative/admin/users/page.tsx.
        href: '/administrative/admin/users',
        label: 'Users',
        icon: <Users className="h-4 w-4" />,
        roles: ADMIN_ROLES,
      },
      {
        // Super-admin only, unlike Users: the API lets a ministry admin read
        // ministries but not change one, so the page would be inert for them.
        // requireRole(['SUPER_ADMIN']) in admin/ministries/page.tsx.
        href: '/administrative/admin/ministries',
        label: 'Ministries',
        icon: <Building2 className="h-4 w-4" />,
        roles: ['SUPER_ADMIN'],
      },
      {
        // Platform-wide values, as opposed to /administrative/settings, which
        // is each user's own preferences.
        // requireRole(['SUPER_ADMIN']) in admin/settings/page.tsx.
        href: '/administrative/admin/settings',
        label: 'Platform settings',
        icon: <SlidersHorizontal className="h-4 w-4" />,
        roles: ['SUPER_ADMIN'],
      },
      {
        // requireRole(ADMIN_ROLES) in app/administrative/reports/page.tsx.
        href: '/administrative/reports',
        label: 'Reports',
        icon: <BarChart3 className="h-4 w-4" />,
        roles: ADMIN_ROLES,
      },
      {
        // Oversight rather than day-to-day administration, so ministry admins
        // are deliberately narrower here than elsewhere in this group — it
        // matches the API, which refuses them.
        href: '/administrative/activity-log',
        label: 'Activity Log',
        icon: <ScrollText className="h-4 w-4" />,
        roles: ['MINISTER', 'SUPER_ADMIN'],
      },
    ],
  },
  {
    title: 'Account',
    items: [
      {
        href: '/administrative/notifications',
        label: 'Notifications',
        icon: <Bell className="h-4 w-4" />,
      },
      {
        // One entry, not the Profile/Settings pair this used to be. Your
        // details, your password and your data are one subject, and splitting
        // them meant remembering which page a thing was on.
        href: '/administrative/profile',
        label: 'Profile',
        icon: <UserCircle className="h-4 w-4" />,
      },
      {
        href: '/administrative/help',
        label: 'Help',
        icon: <HelpCircle className="h-4 w-4" />,
      },
    ],
  },
];

export function SidebarNav({
  collapsed = false,
  onNavigate,
  tourAnchors = true,
}: {
  collapsed?: boolean;
  /**
   * Called once a nav entry or Sign Out is activated, so the mobile drawer can
   * close itself. Deliberately per-link rather than an effect on pathname:
   * tapping the entry for the page you are already on changes no pathname, and
   * would leave the drawer sitting open over the page just asked for.
   */
  onNavigate?: () => void;
  /**
   * Off for the drawer copy. The tour resolves its targets with a document-wide
   * query, so only one copy of the nav may carry data-tour at a time.
   */
  tourAnchors?: boolean;
}) {
  const pathname = usePathname();
  const currentUser = useCurrentUser();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // The server is the authority; this only decides what to render, so an entry
  // is never offered to someone the API would refuse.
  //
  // Groups left with nothing are dropped rather than rendered as a bare
  // heading — for a staff member the whole Administration group disappears.
  const role = currentUser?.systemRole ?? '';
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.roles || item.roles.includes(role),
    ),
  })).filter((group) => group.items.length > 0);

  const handleSignOut = () => {
    onNavigate?.();
    setIsSigningOut(true);
    // Shared with the profile menu, so both routes out behave identically.
    signOut();
  };

  return (
    <nav
      className={cn(
        'flex-1 space-y-6 overflow-y-auto py-5 transition-[padding] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]',
        collapsed ? 'px-3' : 'px-4',
      )}
    >
      {visibleGroups.map((group, index) => (
        <div
          key={group.title}
          className={cn(
            // Collapsed hides the headings, so a hairline is what keeps the
            // grouping legible in the icon rail. Not on the first group, which
            // needs no separator above it.
            collapsed && index > 0 && 'border-t border-sidebar-border pt-4',
          )}
        >
          <p
            className={cn(
              'overflow-hidden px-3 text-[12px] font-semibold uppercase tracking-widest text-sidebar-muted transition-[max-height,opacity,margin] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]',
              collapsed ? 'mb-0 max-h-0 opacity-0' : 'mb-1 max-h-6 opacity-100',
            )}
          >
            {group.title}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                // Collapsed, this rail is the whole navigation and nothing on
                // it is labelled: the span below is not rendered, and the
                // native title it fell back to took a second to appear and was
                // never read aloud. aria-label is the fix for the second half
                // of that; the tooltip is the fix for the first.
                <Tooltip
                  key={item.href}
                  side="right"
                  disabled={!collapsed}
                  content={item.label}
                >
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-label={collapsed ? item.label : undefined}
                    // The active item was signalled by a hue swap alone, over
                    // backgrounds about 2% apart, and screen readers were never
                    // told. Weight carries it without colour; aria-current
                    // carries it without sight.
                    aria-current={isActive ? 'page' : undefined}
                    // Anchor for the guided tour. Derived from the href so a
                    // new nav entry is reachable without remembering to label
                    // it.
                    data-tour={
                      tourAnchors
                        ? `nav-${item.href.split('/').pop()}`
                        : undefined
                    }
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200',
                      collapsed && 'justify-center',
                      isActive
                        ? 'bg-sidebar-accent font-semibold text-sidebar-primary'
                        : 'font-medium text-sidebar-foreground hover:bg-muted',
                    )}
                  >
                    {item.icon}
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </Tooltip>
              );
            })}
          </div>
        </div>
      ))}

      <div className="border-t border-sidebar-border pt-6">
        <Tooltip
          side="right"
          content="Sign out of Smart Meeting on this device"
        >
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            aria-label={collapsed ? 'Sign Out' : undefined}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-all duration-200 hover:bg-red-50 disabled:opacity-60',
              collapsed && 'justify-center',
            )}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && (
              <span>{isSigningOut ? 'Signing out…' : 'Sign Out'}</span>
            )}
          </button>
        </Tooltip>
      </div>
    </nav>
  );
}
