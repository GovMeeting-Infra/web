describe('Events Management', () => {
  beforeEach(() => {
    cy.login('staff@moh.gov.sl', 'not-a-real-password');
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

  // These previously asserted `should('have.class')` with no argument, which
  // cannot fail — it passed against any element with any class at all. Assert
  // the layout that actually has to hold instead.
  describe('Responsive Behavior', () => {
    it('should stack cards in one column on mobile', () => {
      cy.viewport(375, 812);
      cy.contains('Events').should('be.visible');
      cy.contains('Create Event').should('be.visible');
      cy.assertNoClipping();
    });

    it('should show the drawer trigger rather than the sidebar on mobile', () => {
      cy.viewport(375, 812);
      cy.get('aside').should('not.be.visible');
      cy.get('#mobile-menu-button').should('be.visible');
    });

    it('should display properly on tablet', () => {
      cy.viewport(768, 1024);
      cy.contains('Create Event').should('be.visible');
      cy.assertNoClipping();
    });
  });

  // The pages the responsive pass touched most heavily. Each carries a table
  // or a dense grid, which is where clipping shows up first.
  describe('Layout integrity across the admin pages', () => {
    const PAGES = [
      { path: '/administrative/action-items', wait: 'Action Items' },
      { path: '/administrative/minutes', wait: 'Minutes' },
      { path: '/administrative/reports', wait: 'Reports' },
      { path: '/administrative/calendar', wait: 'Calendar' },
      { path: '/administrative/rooms', wait: 'Rooms' },
      { path: '/administrative/activity-log', wait: 'Activity' },
    ];

    PAGES.forEach(({ path, wait }) => {
      it(`should not clip ${path} at 375px`, () => {
        cy.viewport(375, 812);
        cy.visit(path);
        cy.contains(wait).should('be.visible');
        cy.assertNoClipping();
      });

      it(`should not clip ${path} at 768px`, () => {
        cy.viewport(768, 1024);
        cy.visit(path);
        cy.contains(wait).should('be.visible');
        cy.assertNoClipping();
      });
    });
  });
});
