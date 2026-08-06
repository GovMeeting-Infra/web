import type { NextConfig } from "next";
import path from "path";

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
