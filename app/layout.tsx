import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Needed so the relative OpenGraph image paths on the public pages resolve to
  // absolute URLs; without it Next warns at build and share cards get no image.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000",
  ),
  // A template, so every child page keeps the issuing authority in the tab and
  // in search results. Each child set a plain string before, which replaced the
  // whole title — so "Meeting minutes" and "Unsubscribe" appeared on a .gov.sl
  // domain with no government attached, at exactly the point where someone
  // decides whether a link is genuine.
  title: {
    default: "Smart Meeting & Attendance Logger | Government of Sierra Leone",
    template: "%s | Government of Sierra Leone",
  },
  description: "Official government meeting management, attendance tracking, and documentation system for the Government of Sierra Leone.",
};

/**
 * Next already emits width=device-width, initial-scale=1 on its own, so the
 * first two lines only make the default explicit. viewport-fit=cover is the
 * reason this export exists: without it env(safe-area-inset-*) resolves to 0 on
 * a notched phone, so any safe-area padding added later would silently do
 * nothing.
 *
 * No maximumScale or userScalable — pinch-zoom stays available. Fixing the
 * font-size that triggers iOS focus-zoom is the right fix; disabling zoom
 * outright would take it away from people who need it.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#003580",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-dvh antialiased`}
    >
      {/* dvh rather than vh: on iOS Safari 100vh is taller than the visible
          area while the URL bar is expanded, which would push the bottom of
          the app under the browser chrome. The shell scrolls an inner pane,
          not the document, so there is nothing to scroll that strip back into
          view. */}
      <body className="h-dvh bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
