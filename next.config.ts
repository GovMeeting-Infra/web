import type { NextConfig } from "next";
import path from "path";

/**
 * Identifies this build to the service worker.
 *
 * The worker is registered as /sw.js?v=<this>, and names every cache after it,
 * so a deploy makes the browser see a different worker and the old caches get
 * swept on activate. There is no CDN in front of this box, so a shell that
 * outlives its deploy is invisible to everyone and cannot be cleared remotely.
 *
 * Prefers an explicit value, then the commit CI is building, and only then a
 * timestamp. The timestamp means this works without any change to the deploy
 * script — the cost is that two builds of identical source are treated as
 * different, which only ever causes one extra cache sweep.
 *
 * Read once at module scope so every chunk in a build is stamped the same.
 */
const BUILD_ID =
  process.env.NEXT_PUBLIC_BUILD_ID ??
  process.env.GITHUB_SHA ??
  Date.now().toString(36);

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Browser calls hit /api/v1/* on the web origin and are proxied to the NestJS
  // API from here, so client components never need an absolute URL and there is
  // no cross-origin request to configure. Server components cannot use this —
  // they call the API directly via API_BASE in src/lib/api-base.ts.
  //
  // Kept in sync with that module by reading the same INTERNAL_API_URL, but
  // inlining the default rather than importing it: this config is loaded before
  // the `@/` path alias exists. Change the fallback in both places together.
  //
  // IMPORTANT: this destination is resolved at BUILD time and written into
  // .next/routes-manifest.json — setting INTERNAL_API_URL only when running
  // `next start` has no effect (verified: built with :9911, started with :9922,
  // requests still went to :9911). Whatever builds the app must export it.
  // The server-component path in src/lib/api-base.ts reads it at runtime as
  // usual, so the two differ; in practice both resolve to the same loopback
  // address on every host, which is why the mismatch is survivable.
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },

  /**
   * Headers for the service worker itself.
   *
   * Without no-store the worker is cached like any other script, and a deploy
   * cannot roll forward: the browser keeps checking a copy that never changes.
   * The values are the set the Next PWA guide prescribes.
   *
   * Deliberately no global `/(.*)` block, which that guide also suggests.
   * nginx already sets X-Content-Type-Options, X-Frame-Options and
   * Referrer-Policy for this origin, and its X-Frame-Options is SAMEORIGIN
   * where the guide says DENY — adding them here would send each twice and
   * quietly contradict the edge.
   *
   * No Service-Worker-Allowed either: that header only widens scope for a
   * worker served from a subdirectory, and this one is at the origin root, so
   * scope '/' is already its maximum.
   */
  headers: async () => [
    {
      source: '/sw.js',
      headers: [
        {
          key: 'Content-Type',
          value: 'application/javascript; charset=utf-8',
        },
        {
          key: 'Cache-Control',
          value: 'no-cache, no-store, must-revalidate',
        },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self'",
        },
      ],
    },
    {
      source: '/icons/:file*',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
  ],

  rewrites: async () => {
    const apiBase = process.env.INTERNAL_API_URL ?? "http://127.0.0.1:4000";

    return {
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${apiBase}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
