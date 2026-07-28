'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  CalendarRange,
  Users,
  UserCircle,
  HelpCircle,
  Settings,
  LayoutDashboard,
  CalendarDays,
  KanbanSquare,
  ClipboardList,
  BarChart3,
  Building2,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/administrative/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
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
  {
    href: '/administrative/action-items',
    label: 'Action Items',
    icon: <KanbanSquare className="h-4 w-4" />,
  },
  {
    href: '/administrative/minutes',
    label: 'Minutes',
    icon: <ClipboardList className="h-4 w-4" />,
  },
  {
    href: '/administrative/rooms',
    label: 'Rooms',
    icon: <Building2 className="h-4 w-4" />,
  },
  {
    href: '/administrative/admin/users',
    label: 'Users',
    icon: <Users className="h-4 w-4" />,
  },
  {
    href: '/administrative/help',
    label: 'Help',
    icon: <HelpCircle className="h-4 w-4" />,
  },
  {
    href: '/administrative/profile',
    label: 'Profile',
    icon: <UserCircle className="h-4 w-4" />,
  },
  {
    href: '/administrative/settings',
    label: 'Settings',
    icon: <Settings className="h-4 w-4" />,
  },
  {
    href: '/administrative/reports',
    label: 'Reports',
    icon: <BarChart3 className="h-4 w-4" />,
  },
];

export function SidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await fetch('/api/v1/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // The session is what matters, and the server drops it on receipt. If
      // the request never landed, leaving the browser is still the right move.
    }

    // A full document load, not router.push: the session is read by server
    // components, so a client-side navigation would keep rendering the cached
    // signed-in tree. This also discards any in-memory query cache, so the
    // next person to sign in cannot see the previous user's data.
    window.location.href = '/login';
  };

  return (
    <nav
      className={cn(
        'flex-1 space-y-6 overflow-y-auto py-5 transition-[padding] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]',
        collapsed ? 'px-3' : 'px-4',
      )}
    >
      <div>
        <p
          className={cn(
            'overflow-hidden px-3 text-[11px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 transition-[max-height,opacity,margin] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]',
            collapsed ? 'mb-0 max-h-0 opacity-0' : 'mb-1 max-h-6 opacity-100',
          )}
        >
          Main
        </p>
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground hover:bg-muted',
                )}
                title={collapsed ? item.label : undefined}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="border-t border-sidebar-border pt-6">
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-all duration-200 hover:bg-red-50 disabled:opacity-60',
            collapsed && 'justify-center',
          )}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>{isSigningOut ? 'Signing out…' : 'Sign Out'}</span>}
        </button>
      </div>
    </nav>
  );
}
