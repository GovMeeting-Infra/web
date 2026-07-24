describe('Authentication Flow', () => {
  describe('Login', () => {
    it('should display login form', () => {
      cy.visit('/login');
      cy.contains('Welcome').should('be.visible');
      cy.get('input[type="email"]').should('exist');
      cy.get('input[type="password"]').should('exist');
      cy.get('button[type="submit"]').should('exist');
    });

    it('should successfully login with valid credentials', () => {
      cy.visit('/login');
      cy.get('input[type="email"]').type('staff@moh.gov.sl');
      cy.get('input[type="password"]').type('Password@123');
      cy.get('button[type="submit"]').click();
      cy.url().should('include', '/administrative/dashboard');
    });

    it('should show error with invalid credentials', () => {
      cy.visit('/login');
      cy.get('input[type="email"]').type('staff@moh.gov.sl');
      cy.get('input[type="password"]').type('WrongPassword');
      cy.get('button[type="submit"]').click();
      cy.contains('Invalid credentials').should('be.visible');
    });

    it('should show error with invalid email format', () => {
      cy.visit('/login');
      cy.get('input[type="email"]').type('invalid-email');
      cy.get('input[type="password"]').type('Password@123');
      cy.get('button[type="submit"]').click();
      cy.contains('Invalid email').should('be.visible');
    });

    it('should show error with short password', () => {
      cy.visit('/login');
      cy.get('input[type="email"]').type('staff@moh.gov.sl');
      cy.get('input[type="password"]').type('short');
      cy.get('button[type="submit"]').click();
      cy.contains('at least 8 characters').should('be.visible');
    });

    it('should have working remember me checkbox', () => {
      cy.visit('/login');
      cy.get('input[type="checkbox"]').should('exist');
      cy.get('input[type="checkbox"]').check().should('be.checked');
    });

    it('should have working forgot password link', () => {
      cy.visit('/login');
      cy.contains('Forgot password?').should('exist');
      // Uncomment when forgot-password route is created
      // cy.contains('Forgot password?').click();
      // cy.url().should('include', '/forgot-password');
    });
  });

  describe('Session Management', () => {
    beforeEach(() => {
      cy.login('staff@moh.gov.sl', 'Password@123');
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
      cy.url().should('include', '/login');
    });
  });
});
