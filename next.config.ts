import type { NextConfig } from "next";
import path from "path";

/**
 * Versions the service worker's caches and its script URL.
 *
 * The worker lives in public/, so nothing can be templated into it at build
 * time — it learns which build it belongs to from the query string it is
 * registered with, and this is where that value comes from. A changed script
 * URL is also what makes a browser treat a deploy as a worker update.
 *
 * The commit sha in CI, a timestamp locally. Note this is stamped in
 * development too, so it can never be used to tell dev from prod; NODE_ENV does
 * that, and src/lib/pwa/config.ts is where the two are combined.
 */
const BUILD_ID = (process.env.GITHUB_SHA || "").slice(0, 12) || Date.now().toString(36);

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },

  generateBuildId: () => BUILD_ID,

  // Inlined into both the client bundle and the server build, so the page and
  // /sw-control agree on which build is running.
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },

  /**
   * Note for whoever adds a Content-Security-Policy here, because this is where
   * that change will be written:
   *
   * A service worker inherits the CSP served with ITS OWN script, not the one
   * served with the page. So a policy attached to /sw.js governs every fetch()
   * the worker makes. `connect-src` does NOT fall back to `default-src` for
   * those, so a policy of `default-src 'self'` alone leaves the worker unable to
   * reach its own origin — it installs cleanly and then fails every request,
   * looking exactly like a device that is offline while the page beside it is
   * perfectly healthy. Spell out `connect-src 'self'`, and give the page
   * `worker-src 'self'`.
   *
   * There is no CSP anywhere today — not here, not in the infra repo's
   * nginx.conf — which is why this is a comment rather than a policy. Also
   * worth knowing before adding one there instead: nginx.conf has no
   * per-location blocks on purpose, because a `location` carrying its own
   * add_header silently drops every inherited security header.
   */
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        // A worker held in an HTTP cache is a worker that cannot be updated or
        // switched off. The browser revalidates worker scripts on its own, but
        // being explicit costs nothing and this is the one file where being
        // wrong is sticky on every user's device.
        { key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" },
        { key: "Content-Type", value: "application/javascript; charset=utf-8" },
      ],
    },
    {
      // nginx buffers a proxied response until it is complete, which would
      // hold back the launch screen app/administrative/layout.tsx streams
      // ahead of the session lookup — the blank screen it exists to replace.
      // This header is nginx's per-response opt-out, so the instance config
      // needs no change. Scoped to the workspace, the only place that streams.
      source: "/administrative/:path*",
      headers: [{ key: "X-Accel-Buffering", value: "no" }],
    },
  ],
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
