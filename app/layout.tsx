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
      className={`${geistSans.variable} ${geistMono.variable} h-screen antialiased`}
    >
      <body className="h-screen bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
