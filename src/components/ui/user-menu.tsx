'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { UserCircle, HelpCircle, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Tooltip } from './tooltip';
import { signOut } from '@/lib/sign-out';
import { useCurrentUser } from '@/components/SessionProvider';
import { ROLE_LABELS } from '@/lib/types/account';

const LINKS = [
  {
    href: '/administrative/profile',
    label: 'Profile',
    icon: <UserCircle className="h-4 w-4" />,
  },
  {
    href: '/administrative/help',
    label: 'Help',
    icon: <HelpCircle className="h-4 w-4" />,
  },
];

/**
 * The avatar in the top bar.
 *
 * Opens a menu rather than navigating straight to the profile — the avatar is
 * where people look for "who am I signed in as" and for the way out, and both
 * of those were previously only reachable from the sidebar.
 */
export function UserMenu({
  userName,
  userEmail,
}: {
  userName?: string;
  userEmail?: string;
}) {
  const currentUser = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const name = userName ?? currentUser?.name;
  const email = userEmail ?? currentUser?.email;
  const initial = (name ?? email ?? 'U').charAt(0).toUpperCase();

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

  return (
    <div ref={containerRef} className="relative">
      {/* Suppressed while the menu is open, or the hint would sit over it. */}
      <Tooltip
        disabled={open}
        content={name ? `Signed in as ${name}` : 'Your account'}
      >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={name ? `Account menu for ${name}` : 'Account menu'}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          'flex items-center rounded-full border border-border bg-card p-1 transition-colors hover:bg-muted',
          open && 'bg-muted',
        )}
      >
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
          {initial}
        </span>
      </button>
      </Tooltip>

      {open && (
        <div
          role="menu"
          // The height cap, for the same reason the notification panel has
          // one: identity block, three links and a footer come to ~262px
          // starting below a 70px topbar, which runs past a landscape phone's
          // ~331px of dvh and put Sign out under the fold. overflow-hidden
          // meant there was nothing to scroll and no way to reach it.
          className="absolute right-0 z-50 mt-2 max-h-[calc(100dvh-6rem)] w-64 overflow-y-auto overflow-x-hidden rounded-[1.25rem] border border-border bg-card shadow-xl"
        >
          {/* Who you are signed in as. On a shared machine this is the thing
              worth checking before doing anything. */}
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold text-foreground">
              {name ?? 'Signed in'}
            </p>
            {email && (
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            )}
            {currentUser?.systemRole && (
              <span className="mt-1.5 inline-block rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-primary">
                {ROLE_LABELS[currentUser.systemRole] ?? currentUser.systemRole}
              </span>
            )}
          </div>

          <ul className="py-1">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  {link.icon}
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-t border-border py-1">
            <button
              type="button"
              disabled={isSigningOut}
              onClick={() => {
                setIsSigningOut(true);
                signOut();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
