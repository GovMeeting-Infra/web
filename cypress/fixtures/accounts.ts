/**
 * The one place the test account is named.
 *
 * Imported by both the provisioning task and the specs, so a spec can never
 * drift from the account that was actually created — which is how the old
 * suite ended up signing in with the literal string 'not-a-real-password'.
 */
export const FIXTURE = {
  ministry: {
    id: 'cypress-fixture-ministry',
    name: 'Cypress Fixture Ministry',
    code: 'CYP',
    emailDomain: 'cypress.gov.sl',
  },
  admin: {
    id: 'cypress-fixture-admin',
    email: 'cypress.admin@cypress.gov.sl',
    name: 'Cypress Admin',
    /**
     * Not a secret, and it never reaches anything but a local database — the
     * provisioning task refuses to run against any other host.
     */
    password: 'CypressFixture!2026',
    systemRole: 'MINISTRY_ADMIN',
  },
  /**
   * Somebody to be the deputy on a meeting.
   *
   * Not decoration: an internal meeting is refused without a co-organizer,
   * because a meeting owned by one person becomes unmanageable the moment that
   * person is unavailable. Needs no password — it never signs in — which also
   * keeps it clear of the reset rate limit.
   */
  deputy: {
    id: 'cypress-fixture-deputy',
    email: 'cypress.deputy@cypress.gov.sl',
    name: 'Cypress Deputy',
    systemRole: 'STAFF',
  },
  /**
   * A second ministry, so "another ministry cannot read this" stays testable.
   *
   * That refusal is the kind of thing a suite exists to hold: it is invisible
   * when it works, and expensive when it stops.
   */
  otherMinistry: {
    id: 'cypress-fixture-other-ministry',
    name: 'Cypress Other Ministry',
    code: 'CYO',
    emailDomain: 'other.gov.sl',
  },
  outsider: {
    id: 'cypress-fixture-outsider',
    email: 'cypress.outsider@other.gov.sl',
    name: 'Cypress Outsider',
    password: 'CypressFixture!2026',
    systemRole: 'MINISTRY_ADMIN',
  },
} as const;

export type FixtureRole = 'admin' | 'outsider';
