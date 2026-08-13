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
      // be.visible, not exist: the button this replaced was hidden at every
      // width and inert, and `exist` passed against it happily.
      cy.get('#mobile-menu-button').should('be.visible');
    });

    it('should hide the sidebar and show the drawer trigger on mobile', () => {
      cy.viewport('iphone-x');
      cy.get('aside').should('not.be.visible');
      cy.get('#mobile-menu-button')
        .should('be.visible')
        .and('have.attr', 'aria-expanded', 'false');
    });

    it('should open and close the navigation drawer on mobile', () => {
      cy.viewport('iphone-x');

      cy.get('#mobile-nav-drawer').should('not.exist');
      cy.get('#mobile-menu-button').click();

      cy.get('#mobile-nav-drawer')
        .should('be.visible')
        .and('have.attr', 'aria-modal', 'true');
      cy.get('#mobile-nav-drawer').contains('Events').should('be.visible');
      cy.get('#mobile-menu-button').should(
        'have.attr',
        'aria-expanded',
        'true',
      );

      cy.get('button[aria-label="Close navigation menu"]').click();
      cy.get('#mobile-nav-drawer').should('not.exist');
    });

    it('should close the drawer on Escape', () => {
      cy.viewport('iphone-x');
      cy.get('#mobile-menu-button').click();
      cy.get('#mobile-nav-drawer').should('be.visible');
      cy.get('body').type('{esc}');
      cy.get('#mobile-nav-drawer').should('not.exist');
    });

    it('should close the drawer after navigating from it', () => {
      cy.viewport('iphone-x');
      cy.get('#mobile-menu-button').click();
      cy.get('#mobile-nav-drawer').contains('Events').click();

      cy.url().should('include', '/administrative/events');
      cy.get('#mobile-nav-drawer').should('not.exist');
    });

    it('should keep the tour anchors unique while the drawer is open', () => {
      cy.viewport('iphone-x');
      cy.get('#mobile-menu-button').click();
      cy.get('#mobile-nav-drawer').should('be.visible');
      // The tour resolves targets with a document-wide query, so a second
      // copy of the nav carrying data-tour would make it highlight the
      // off-screen one.
      cy.get('[data-tour="nav-calendar"]').should('have.length', 1);
    });

    it('should be responsive on tablet', () => {
      cy.viewport('ipad-2');
      cy.contains('Welcome back').should('be.visible');
      // 768px: the sidebar costs 288px here, so the drawer stands in for it.
      cy.get('aside').should('not.be.visible');
      cy.get('#mobile-menu-button').should('be.visible');
    });

    it('should show the sidebar on desktop', () => {
      cy.viewport(1280, 800);
      cy.get('aside').should('be.visible');
      cy.get('#mobile-menu-button').should('not.be.visible');
    });

    it('should close the drawer when the viewport grows past lg', () => {
      cy.viewport('iphone-x');
      cy.get('#mobile-menu-button').click();
      cy.get('#mobile-nav-drawer').should('be.visible');

      // Rotating into a tablet-width layout hides the drawer in CSS while
      // React still thinks it is open, which would leave the focus trap
      // herding focus into something nobody can see.
      cy.viewport(1280, 800);
      cy.get('#mobile-nav-drawer').should('not.exist');
      cy.get('aside').should('be.visible');
    });
  });

  // assertNoClipping now lives in cypress/support/e2e.ts — every page in the
  // responsive pass needs it, not just this one.
  describe('Layout integrity', () => {
    it('should not clip content at 375px', () => {
      cy.viewport(375, 812);
      cy.contains('Welcome back').should('be.visible');
      cy.assertNoClipping();
    });

    it('should not clip content at 768px', () => {
      cy.viewport(768, 1024);
      cy.contains('Welcome back').should('be.visible');
      cy.assertNoClipping();
    });

    it('should not clip content on a landscape phone', () => {
      // The short-viewport case: 375px of height is where anything relying on
      // vertical room — the notification panel, a modal — runs out of it.
      cy.viewport(667, 375);
      cy.contains('Welcome back').should('be.visible');
      cy.assertNoClipping();
    });
  });

  describe('Notification panel', () => {
    it('should stay on screen on a narrow phone', () => {
      cy.viewport(375, 812);
      // The bell is not the last thing in the header, so a panel clamped to
      // the full viewport width runs off the left edge and gets swallowed by
      // the column's overflow-hidden.
      cy.get('button[aria-label^="Notifications"]').click();
      cy.get('[role="menu"]').should('be.visible');
      cy.get('[role="menu"]').then(($panel) => {
        expect($panel[0].getBoundingClientRect().left).to.be.at.least(0);
      });
    });

    it('should stay reachable on a landscape phone', () => {
      cy.viewport(667, 375);
      cy.get('button[aria-label^="Notifications"]').click();
      cy.get('[role="menu"]').then(($panel) => {
        const rect = $panel[0].getBoundingClientRect();
        // The panel caps its own height and scrolls; what must not happen is
        // it running past the bottom with the footer link unreachable.
        expect(rect.bottom).to.be.at.most(375);
      });
    });
  });
});
