/**
 * Base URL for server-side calls to the NestJS API.
 *
 * Server components must call the API directly rather than through the
 * /api/:path* rewrite in next.config.ts — that rewrite exists for the browser,
 * and a server-side fetch to a relative path has no origin to resolve against.
 *
 * Set INTERNAL_API_URL to match the API's APP_PORT. Web and API always share a
 * host (locally, and on the EC2 box behind nginx), so this stays a loopback
 * address in every environment — it is never the public api.* hostname, which
 * would take the request out through nginx and back for no reason.
 *
 * 127.0.0.1 rather than localhost: Node resolves `localhost` to IPv6 ::1 first,
 * and the API binds IPv4, so `localhost` intermittently yields ECONNREFUSED.
 *
 * next.config.ts reads the same variable, but inlines this default rather than
 * importing it — the config is loaded before the `@/` path alias is wired up.
 * Note the timing differs: this module is read at runtime, while the rewrite
 * destination is baked in at build time. Keep the two defaults identical.
 */
export const API_BASE = process.env.INTERNAL_API_URL ?? 'http://127.0.0.1:4000';
