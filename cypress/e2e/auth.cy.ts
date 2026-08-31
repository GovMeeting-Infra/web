// Sign-in lives under the (auth) route group at /administrative/login. Every
// visit here used to be a bare /login, which has never been a route — so these
// specs were asserting against a 404 body and only "passed" where the
// assertion happened to be absent.
const LOGIN = '/administrative/login';

describe('Authentication Flow', () => {
  describe('Protected routes without a session', () => {
    // The administrative layout used to render its whole shell for a signed-out
    // visitor and let the client queries fail one by one, so people sat looking
    // at a sidebar, a header and a page where nothing worked, with a message in
    // the middle telling them their session had ended.
    beforeEach(() => {
      cy.clearCookies();
    });

    ['/administrative/dashboard', '/administrative/events', '/administrative/profile'].forEach(
      (path) => {
        it(`sends a signed-out visitor from ${path} to sign in`, () => {
          cy.visit(path);
          cy.url().should('include', LOGIN);
          cy.contains('Welcome').should('be.visible');
        });
      },
    );

    it('does not leave the workspace furniture on screen', () => {
      cy.visit('/administrative/dashboard');
      cy.url().should('include', LOGIN);
      cy.contains('Your session has ended').should('not.exist');
    });
  });

  describe('Login', () => {
    it('should display login form', () => {
      cy.visit(LOGIN);
      cy.contains('Welcome').should('be.visible');
      cy.get('input[type="email"]').should('exist');
      cy.get('input[type="password"]').should('exist');
      cy.get('button[type="submit"]').should('exist');
    });

    it('should successfully login with valid credentials', () => {
      cy.visit(LOGIN);
      cy.get('input[type="email"]').type('staff@moh.gov.sl');
      cy.get('input[type="password"]').type('not-a-real-password');
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/administrative/dashboard');
    });

    it('should show error with invalid credentials', () => {
      cy.visit(LOGIN);
      cy.get('input[type="email"]').type('staff@moh.gov.sl');
      cy.get('input[type="password"]').type('WrongPassword');
      cy.get('button[type="submit"]').click();
      cy.contains('Invalid credentials').should('be.visible');
    });

    it('should show error with invalid email format', () => {
      cy.visit(LOGIN);
      cy.get('input[type="email"]').type('invalid-email');
      cy.get('input[type="password"]').type('not-a-real-password');
      cy.get('button[type="submit"]').click();
      cy.contains('Invalid email').should('be.visible');
    });

    it('should show error with short password', () => {
      cy.visit(LOGIN);
      cy.get('input[type="email"]').type('staff@moh.gov.sl');
      cy.get('input[type="password"]').type('short');
      cy.get('button[type="submit"]').click();
      cy.contains('at least 8 characters').should('be.visible');
    });

    it('should have working remember me checkbox', () => {
      cy.visit(LOGIN);
      cy.get('input[type="checkbox"]').should('exist');
      cy.get('input[type="checkbox"]').check().should('be.checked');
    });

    it('should have working forgot password link', () => {
      cy.visit(LOGIN);
      cy.contains('Forgot password?').click();
      cy.url().should('include', '/forgot-password');
    });
  });

  // The first page anyone reaches on a phone, and until now the only one with
  // no viewport coverage at all.
  describe('Login — responsive', () => {
    it('should drop the branding panel and show its mobile stand-in', () => {
      cy.viewport(375, 812);
      cy.visit(LOGIN);

      // The gradient panel is md:flex, so below md the branding has to come
      // from the in-form header instead — otherwise the page loses its
      // government identity entirely on a phone.
      cy.get('aside').should('not.be.visible');
      cy.contains('Government of Sierra Leone').should('be.visible');
      cy.get('input[type="email"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
      cy.assertNoClipping();
    });

    it('should show the branding panel on desktop', () => {
      cy.viewport(1280, 800);
      cy.visit(LOGIN);
      cy.get('aside').should('be.visible');
    });

    it('should not clip on a landscape phone', () => {
      // 375 tall with the keyboard yet to open: the form column is the part
      // that has to scroll rather than overflow.
      cy.viewport(667, 375);
      cy.visit(LOGIN);
      cy.get('input[type="email"]').should('be.visible');
      cy.assertNoClipping();
    });
  });

  describe('Session Management', () => {
    beforeEach(() => {
      cy.login('staff@moh.gov.sl', 'not-a-real-password');
    });

    it('should maintain session after navigation', () => {
      cy.visit('/administrative/events');
      cy.url().should('include', '/events');
      cy.contains('Events').should('be.visible');
    });

    it('should access protected routes when logged in', () => {
      cy.visit('/administrative/dashboard');
      cy.contains('Welcome back').should('be.visible');
    });

    it('should show user profile in topbar', () => {
      cy.get('button').contains('S').should('be.visible'); // First initial
    });

    it('should logout successfully', () => {
      cy.logout();
    });
  });
});
