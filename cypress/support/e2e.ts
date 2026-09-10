// Cypress support commands

import { FIXTURE, type FixtureRole } from '../fixtures/accounts';

interface FixtureAccounts {
  admin: { email: string; password: string };
  outsider: { email: string; password: string };
}

// Sign-in lives under the (auth) route group. /login has never existed, so
// every spec using this command was hitting a 404 before it reached its own
// assertions.
const LOGIN_PATH = '/administrative/login';

/**
 * Clear what previous runs left behind, once per spec file.
 *
 * Meetings created by a test are not cleaned up by it — a failing test should
 * leave its evidence — so they accumulate, and after a dozen runs the meeting a
 * test just made is on the second page of a list the test is looking at the
 * first page of. The failure then reads as "the events page does not show new
 * meetings", which is alarming and wrong.
 *
 * Scoped to the fixture ministries, so a developer's own data in the same
 * database is untouched.
 */
before(() => {
  cy.task('cleanupFixture');
});

/**
 * Sign in as the fixture account, provisioning it if it is not there yet.
 *
 * Takes no arguments on purpose. The old command took an email and a password,
 * and every caller passed the literal string 'not-a-real-password' — a value
 * nobody had ever set — so the whole suite failed at its first step and stayed
 * that way. There is now one account, named in one file, created by the task
 * that sets its password.
 */
Cypress.Commands.add('login', (role: FixtureRole = 'admin') => {
  cy.task<FixtureAccounts>('provisionFixture').then((accounts) => {
    const account = accounts[role];
    cy.visit(LOGIN_PATH);
    cy.get('input[type="email"]').type(account.email);
    cy.get('input[type="password"]').type(account.password);
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/administrative/dashboard');
  });
});

Cypress.Commands.add('logout', () => {
  cy.get('button').contains('Sign Out').click();
  // The full path, not just '/login': that substring is also contained in
  // '/administrative/login', so the loose form would pass against a redirect
  // to a route that no longer exists.
  cy.url().should('include', LOGIN_PATH);
});

/**
 * Create a meeting through the API, as the signed-in fixture user.
 *
 * Specs used to assert on rows somebody had seeded — "an event in July",
 * "Cabinet Meeting" — and when seeding was removed those assertions became
 * claims about a database nobody was maintaining. A spec that needs a meeting
 * now makes one, so it passes on a fresh machine and says what it actually
 * depends on.
 *
 * cy.request carries the session cookie the browser already holds, so this is
 * the same authorisation a click would have.
 */
Cypress.Commands.add('createEvent', (overrides = {}) => {
  /*
   * Under way, not upcoming.
   *
   * The events page opens on "Happening now", so a meeting starting in an hour
   * is real, listed, and on a tab nobody clicked — which reads as the page
   * failing to show a meeting that was just created. It also suits check-in,
   * which needs a meeting that has not ended.
   */
  const startAt = new Date(Date.now() - 30 * 60_000).toISOString();
  const endAt = new Date(Date.now() + 90 * 60_000).toISOString();

  return cy
    .request({
      method: 'POST',
      url: '/api/v1/events',
      body: {
        title: 'Cypress Test Meeting',
        isPublic: false,
        startAt,
        endAt,
        venueName: 'Cypress Boardroom',
        // An internal meeting is refused without one: a meeting owned by a
        // single person becomes unmanageable the moment they are unavailable.
        coOrganizerIds: [FIXTURE.deputy.id],
        ...overrides,
      },
      failOnStatusCode: false,
    })
    .then((response) => {
      expect(
        response.status,
        `creating a meeting: ${JSON.stringify(response.body)}`,
      ).to.be.oneOf([200, 201]);
      return response.body;
    });
});

/**
 * Fails if any element is wider than the box it sits in.
 *
 * Checking for a document-level horizontal scrollbar does not work here: the
 * shell's <main> is overflow-x-hidden, so content that overflows is clipped and
 * silently unreachable rather than scrollable. The page looks clean while a
 * table or a button sits off-screen. So walk the tree instead, and skip
 * elements that scroll on purpose (overflow-x other than visible) — those are
 * the deliberate `overflow-x-auto` table wrappers.
 */
Cypress.Commands.add('assertNoClipping', () => {
  cy.document().then((doc) => {
    const offenders = Array.from(doc.querySelectorAll<HTMLElement>('*'))
      .filter((el) => {
        const style = doc.defaultView!.getComputedStyle(el);
        if (style.overflowX !== 'visible' || style.display === 'none') {
          return false;
        }
        /*
         * A form field scrolls its own text, by design.
         *
         * Type a name longer than a narrow box and scrollWidth exceeds
         * clientWidth — which is this check's definition of clipping, and is
         * simply what an input does. Left in, any spec that fills a field on a
         * 320px screen reports a layout bug that is not there, and the useful
         * signal gets lost among them.
         */
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return false;
        return el.scrollWidth > el.clientWidth + 1;
      })
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 120));

    // have.length(0) rather than be.empty: the latter is a bare property
    // access, which reads to eslint as an expression that does nothing.
    expect(
      offenders,
      `clipped elements:\n${offenders.join('\n')}`,
    ).to.have.length(0);
  });
});

/** The parts of a created meeting a spec actually uses. */
export interface CreatedEvent {
  id: string;
  title: string;
}

declare global {
  /*
   * Silenced with a reason, not ignored.
   *
   * Augmenting Cypress's Chainable is only possible through this namespace —
   * it is the shape the library declares, and module syntax cannot reach into
   * it. The rule is right in general and unsatisfiable here, so it is disabled
   * narrowly rather than left as one of the standing errors that keeps the
   * whole lint step advisory.
   */
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Signs in as the fixture account; 'outsider' belongs to another ministry. */
      login(role?: FixtureRole): Chainable<void>;
      logout(): Chainable<void>;
      assertNoClipping(): Chainable<void>;
      /** Creates a meeting via the API and yields it. */
      createEvent(overrides?: Record<string, unknown>): Chainable<CreatedEvent>;
    }
  }
}

export {};
