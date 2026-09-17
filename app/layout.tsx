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
  /**
   * iOS reads none of the web app manifest for the home-screen label, so
   * `title` here is what appears under the icon — not the manifest's
   * short_name. Without `capable`, an added-to-home-screen copy opens in a
   * Safari tab with the address bar, which is the whole thing people install to
   * get rid of.
   *
   * statusBarStyle stays "default" rather than "black-translucent". Translucent
   * is the one that looks native, and it works by letting page content run
   * underneath the status bar — but src/components/ui/topbar.tsx has no
   * env(safe-area-inset-top) padding, so the top of the header would sit under
   * the clock on every iPhone. Worth revisiting once the topbar pads for it.
   */
  appleWebApp: {
    capable: true,
    title: "Smart Meeting",
    statusBarStyle: "default",
  },
  /**
   * Belt and braces for older iPads, of which this user base has plenty.
   *
   * `appleWebApp.capable` above makes Next emit the standardised
   * <meta name="mobile-web-app-capable">, and nothing else — verified against
   * the built output on 16.2.11. Current iOS does not need a meta tag at all,
   * because it reads display:standalone out of the manifest. But iOS versions
   * predating manifest support recognise only Apple's own prefixed name, so
   * without this line they open the home-screen copy in a Safari tab, complete
   * with the address bar people installed the app to be rid of.
   *
   * Harmless where it is not needed: a browser that understands the manifest
   * ignores it.
   */
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
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
