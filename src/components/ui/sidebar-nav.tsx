'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  KanbanSquare,
  ClipboardList,
  BarChart3,
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
    href: '/administrative/reports',
    label: 'Reports',
    icon: <BarChart3 className="h-4 w-4" />,
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-6 overflow-y-auto py-5 px-4">
      <div>
        <p className="px-3 text-xs font-bold uppercase tracking-wider text-color-muted-foreground">
          Main
        </p>
        <div className="mt-3 space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-color-sidebar-accent text-color-sidebar-primary'
                    : 'text-color-sidebar-foreground hover:bg-color-muted',
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="border-t border-color-sidebar-border pt-6">
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-color-destructive transition-all duration-200 hover:bg-red-50">
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </nav>
  );
}
