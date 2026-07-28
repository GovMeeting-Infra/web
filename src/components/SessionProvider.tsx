'use client';

import { createContext, useContext, ReactNode } from 'react';
import type { CurrentUser } from '@/lib/session';

const SessionContext = createContext<CurrentUser | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: CurrentUser | null;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
  );
}

export function useCurrentUser(): CurrentUser | null {
  return useContext(SessionContext);
}
