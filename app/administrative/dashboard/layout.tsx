import type { Metadata } from 'next';

/**
 * The page itself is a client component and cannot export metadata, so the tab
 * title lives here. Staff keep several of these open at once — events, minutes,
 * the board — and every one of them read the same root-layout title.
 */
export const metadata: Metadata = {
  title: 'Dashboard',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
