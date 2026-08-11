// Cypress support commands
Cypress.Commands.add('login', (email: string, password: string) => {
  // /login has never existed — the page lives under the (auth) group at
  // /administrative/login, so every spec using this command was failing on a
  // 404 before it reached its own assertions.
  cy.visit('/administrative/login');
  cy.get('input[type="email"]').type(email);
  cy.get('input[type="password"]').type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('include', '/administrative/dashboard');
});

Cypress.Commands.add('logout', () => {
  cy.get('button').contains('Sign Out').click();
  cy.url().should('include', '/login');
});

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      logout(): Chainable<void>;
    }
  }
}

export {};
