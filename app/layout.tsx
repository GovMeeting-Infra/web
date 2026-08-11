import type { Metadata } from "next";
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
  title: "Smart Meeting Logger | Government of Sierra Leone",
  description: "Official government meeting management, attendance tracking, and documentation system for the Government of Sierra Leone.",
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
