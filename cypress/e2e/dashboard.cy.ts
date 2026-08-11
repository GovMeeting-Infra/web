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
  });

  describe('Layout integrity', () => {
    // <main> is overflow-x-hidden, so overflowing content is clipped rather
    // than producing a page-level scrollbar. Checking the document alone would
    // report clean while content sits unreachable off-screen.
    const assertNoClipping = () => {
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
    };

    it('should not clip content at 375px', () => {
      cy.viewport(375, 812);
      cy.contains('Welcome back').should('be.visible');
      assertNoClipping();
    });

    it('should not clip content at 768px', () => {
      cy.viewport(768, 1024);
      cy.contains('Welcome back').should('be.visible');
      assertNoClipping();
    });
  });
});
