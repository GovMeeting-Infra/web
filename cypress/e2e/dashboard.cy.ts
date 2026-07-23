describe('Dashboard', () => {
  beforeEach(() => {
    cy.login('staff@moh.gov.sl', 'Password@123');
    cy.visit('/administrative/dashboard');
  });

  describe('Layout and Navigation', () => {
    it('should display dashboard header', () => {
      cy.contains('Welcome back').should('be.visible');
      cy.contains('Monitor your meetings').should('be.visible');
    });

    it('should display sidebar navigation', () => {
      cy.contains('Dashboard').should('be.visible');
      cy.contains('Events').should('be.visible');
      cy.contains('Action Items').should('be.visible');
      cy.contains('Minutes').should('be.visible');
      cy.contains('Reports').should('be.visible');
    });

    it('should display topbar with ministry name', () => {
      cy.contains('Ministry of Health').should('be.visible');
    });

    it('should have working navigation links', () => {
      cy.contains('Events').click();
      cy.url().should('include', '/events');
      cy.go('back');
      cy.url().should('include', '/dashboard');
    });
  });

  describe('Stats Cards', () => {
    it('should display all stats cards', () => {
      cy.contains('Total Events').should('be.visible');
      cy.contains('Avg Attendance').should('be.visible');
      cy.contains('Minutes Recorded').should('be.visible');
      cy.contains('Action Items').should('be.visible');
    });

    it('should display stats with values', () => {
      cy.get('h1, h2, h3, span').contains(/\d+/).should('exist');
    });

    it('should display trend indicators', () => {
      cy.contains(/↑|↓/).should('exist');
    });
  });

  describe('Recent Events Section', () => {
    it('should display recent events', () => {
      cy.contains('Recent Events').should('be.visible');
    });

    it('should display event details', () => {
      cy.get('p').contains('Cabinet Meeting').should('exist');
      cy.get('p').contains(/\d{4}/).should('exist'); // Date
    });

    it('should display status badge', () => {
      cy.contains('Completed').should('be.visible');
    });
  });

  describe('Responsive Design', () => {
    it('should be responsive on mobile', () => {
      cy.viewport('iphone-x');
      cy.contains('Welcome back').should('be.visible');
      cy.get('button[aria-label="Toggle menu"]').should('exist');
    });

    it('should be responsive on tablet', () => {
      cy.viewport('ipad-2');
      cy.contains('Welcome back').should('be.visible');
    });
  });
});
