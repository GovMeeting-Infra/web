import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Unit tests for the offline core.
 *
 * Deliberately narrow. This does not try to be a second end-to-end runner —
 * Cypress is that, and it needs a seeded database and a signed-in session.
 * These cover the pure decisions the offline path rests on: which routes may be
 * deferred, what collapses onto what, which failures are worth retrying, and
 * what the connectivity store reports. Those need no server, run in a second,
 * and are where the bugs actually were.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    // The outbox talks to IndexedDB, which jsdom does not provide.
    setupFiles: ['./src/lib/offline/__tests__/setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
