describe('Events Management', () => {
  beforeEach(() => {
    cy.login('staff@moh.gov.sl', 'Password@123');
    cy.visit('/administrative/events');
  });

  describe('Events List Page', () => {
    it('should display events page header', () => {
      cy.contains('Events').should('be.visible');
      cy.contains('Manage your ministry').should('be.visible');
    });

    it('should display create event button', () => {
      cy.contains('Create Event').should('be.visible');
    });

    it('should display events grid', () => {
      cy.get('[class*="grid"]').should('exist');
    });

    it('should display event cards with details', () => {
      cy.get('[class*="rounded"]').contains(/[A-Z]/).should('exist');
      cy.contains(/July|August/).should('exist');
      cy.contains(/AM|PM/).should('exist');
    });

    it('should display event status badges', () => {
      cy.contains('Published').should('be.visible');
    });

    it('should have edit and view buttons on event cards', () => {
      cy.get('button').contains('Edit').should('exist');
      cy.get('button').contains('View').should('exist');
    });
  });

  describe('Creating Event', () => {
    it('should navigate to create event page', () => {
      cy.contains('Create Event').click();
      cy.url().should('include', '/events/new');
    });

    it('should have event form fields', () => {
      cy.contains('Create Event').click();
      cy.get('input[type="text"]').should('exist'); // Title
      cy.get('input[type="date"]').should('exist'); // Date
      cy.get('input[type="time"]').should('exist'); // Time
    });

    it('should reject form with missing required fields', () => {
      cy.contains('Create Event').click();
      cy.get('button').contains('Create').click();
      cy.contains(/required|mandatory|must/i).should('exist');
    });

    it('should submit event form with valid data', () => {
      cy.contains('Create Event').click();
      cy.get('input[placeholder*="Title"]').type('New Test Event');
      cy.get('input[type="date"]').first().type('2026-08-15');
      cy.get('input[type="time"]').first().type('10:00');
      cy.get('input[type="time"]').last().type('11:00');
      cy.get('button').contains('Create').click();
      cy.url().should('include', '/events');
    });
  });

  describe('Event Filtering', () => {
    it('should have filter options', () => {
      cy.get('input[placeholder*="Search"]').should('exist');
    });

    it('should filter events by search', () => {
      cy.get('input[placeholder*="Search"]').type('Cabinet');
      cy.get('h3, [class*="font-semibold"]').contains('Cabinet').should('exist');
    });
  });

  describe('Event Actions', () => {
    it('should open event details on view click', () => {
      cy.get('button').contains('View').first().click();
      cy.url().should('include', '/events/');
    });

    it('should open event edit on edit click', () => {
      cy.get('button').contains('Edit').first().click();
      cy.url().should('include', '/events/').and('include', 'edit');
    });

    it('should display event details page', () => {
      cy.get('button').contains('View').first().click();
      cy.contains(/Event Details|Meeting Details/).should('be.visible');
    });
  });

  describe('Responsive Behavior', () => {
    it('should stack cards on mobile', () => {
      cy.viewport('iphone-x');
      cy.get('[class*="grid"]').should('have.class');
      cy.contains('Events').should('be.visible');
    });

    it('should display properly on tablet', () => {
      cy.viewport('ipad-2');
      cy.get('[class*="grid"]').should('exist');
      cy.contains('Create Event').should('be.visible');
    });
  });
});
