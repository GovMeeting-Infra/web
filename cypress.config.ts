import { defineConfig } from 'cypress';
import { provisionFixture, cleanupFixture } from './cypress/tasks/provision';

/**
 * Where the fixture is created, and the only place these defaults live.
 *
 * Both are overridable so the suite can point at a different local stack, and
 * neither may be remote: provision.ts refuses any database host that is not on
 * this machine.
 */
const DATABASE_URL =
  process.env.CYPRESS_DATABASE_URL ??
  'postgresql://postgres:devpass@localhost:5432/govmeeting_dev';
const API_URL = process.env.CYPRESS_API_URL ?? 'http://localhost:4000';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    // Cypress defaults to 1000x660, which is below the lg breakpoint the
    // sidebar appears at — every spec asserting on nav links would run against
    // the mobile layout. Specs that want mobile ask for it with cy.viewport().
    /*
     * The fixture task does more than a task usually does — it compiles on
     * first use, opens a database connection and makes four HTTP calls — and
     * the 60s default expired on whichever spec happened to run first, which
     * looked like a broken suite rather than a slow first step.
     */
    taskTimeout: 120_000,
    viewportWidth: 1280,
    viewportHeight: 800,
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    video: true,
    screenshotOnRunFailure: true,
    setupNodeEvents(on) {
      on('task', {
        /**
         * Ensures the fixture account exists and returns its credentials.
         *
         * A task rather than a global before-hook so a spec that does not need
         * to sign in does not pay for one, and so the failure — "the API is not
         * running" — is reported against the thing that needed it.
         */
        provisionFixture: () =>
          provisionFixture({ databaseUrl: DATABASE_URL, apiUrl: API_URL }),
        cleanupFixture: () => cleanupFixture(DATABASE_URL),
      });
    },
  },
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
  },
});
