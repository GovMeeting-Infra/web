// Cypress support commands

// Sign-in lives under the (auth) route group. /login has never existed, so
// every spec using this command was hitting a 404 before it reached its own
// assertions.
const LOGIN_PATH = '/administrative/login';

Cypress.Commands.add('login', (email: string, password: string) => {
  cy.visit(LOGIN_PATH);
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('include', '/administrative/dashboard');
});

Cypress.Commands.add('logout', () => {
  cy.get('button').contains('Sign Out').click();
  // The full path, not just '/login': that substring is also contained in
  // '/administrative/login', so the loose form would pass against a redirect
  // to a route that no longer exists.
  cy.url().should('include', LOGIN_PATH);
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

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      logout(): Chainable<void>;
      assertNoClipping(): Chainable<void>;
    }
  }
}

export {};
