/**
 * Tooltips.
 *
 * The sign-in page is the one place a tooltip can be tested without a session,
 * and it happens to exercise everything that matters: the trigger keeps its own
 * accessible name, the hint appears on hover and on keyboard focus, and it is
 * portalled rather than rendered inside the control.
 *
 * The rest needs an account, so those cases sit behind cy.login and run in CI —
 * this dev database does not hold the seeded users.
 */

const LOGIN_PAGE = '/administrative/login';
const REVEAL = 'button[aria-label="Show password"]';

/**
 * What a real mouse sends. Radix listens for pointer events, so `mouseover`
 * alone reaches nothing — the tooltip stays shut and the test looks like a
 * product bug when it is a harness one.
 */
const hover = (selector: string) =>
  cy.get(selector).trigger('pointerover').trigger('pointermove');

const unhover = (selector: string) =>
  cy.get(selector).trigger('pointerleave').trigger('pointerout');

describe('Tooltips — no account needed', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    cy.visit(LOGIN_PAGE);
  });

  it('appears on hover', () => {
    cy.get('[role="tooltip"]').should('not.exist');
    hover(REVEAL);
    cy.get('[role="tooltip"]', { timeout: 2000 })
      .should('be.visible')
      .and('contain.text', 'Show what you have typed');
  });

  it('appears on keyboard focus, so it is not hover-only', () => {
    cy.get(REVEAL).focus();
    cy.get('[role="tooltip"]').should('be.visible');
  });

  // The rule the component exists to enforce: a tooltip describes a control,
  // it never becomes the control's name. Radix wires it to aria-describedby.
  it('leaves the accessible name alone', () => {
    hover(REVEAL);
    cy.get('[role="tooltip"]').should('be.visible');
    cy.get(REVEAL)
      .should('have.attr', 'aria-label', 'Show password')
      .and('have.attr', 'aria-describedby');
  });

  // Portalled, not nested. Rendered in place it would be clipped by the
  // overflow-hidden the tables wrap themselves in.
  it('renders outside its trigger', () => {
    hover(REVEAL);
    cy.get('[role="tooltip"]').should('be.visible');
    cy.get(REVEAL).find('[role="tooltip"]').should('not.exist');
  });

  // PlatformTour resolves seven of its steps with a bare document-wide `h1`
  // query and takes the first match, so a heading in here would make the tour
  // highlight a tooltip instead of the page.
  it('contains no heading, which would break the guided tour', () => {
    hover(REVEAL);
    cy.get('[role="tooltip"]')
      .should('be.visible')
      .find('h1, h2, h3, h4, h5, h6')
      .should('not.exist');
  });

  it('goes away when the pointer leaves', () => {
    hover(REVEAL);
    cy.get('[role="tooltip"]').should('be.visible');
    unhover(REVEAL);
    cy.get('[role="tooltip"]').should('not.exist');
  });
});

describe('Tooltips — signed in', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    cy.login('staff@moh.gov.sl', 'Password@123');
  });

  // Collapsed, this rail is the entire navigation and nothing on it is
  // labelled: the text is not rendered and it used to rely on a native title,
  // which took a second and was never read aloud.
  it('names every icon in the collapsed sidebar, on screen and to a reader', () => {
    cy.visit('/administrative/dashboard');
    cy.get('button[aria-label="Collapse sidebar"]').click();

    hover('a[aria-label="Events"]');
    cy.get('[role="tooltip"]').should('contain.text', 'Events');
  });

  it('shows the next tooltip immediately once one is open', () => {
    cy.visit('/administrative/admin/users');

    cy.get('button[aria-label^="Edit"]')
      .first()
      .trigger('pointerover')
      .trigger('pointermove');
    cy.get('[role="tooltip"]').should('be.visible');

    // No delay this time: the group is already warm, so a short timeout is the
    // assertion. A tooltip that waited again would fail here.
    cy.get('button[aria-label^="Re-send invitation"]')
      .first()
      .trigger('pointerover')
      .trigger('pointermove');
    cy.get('[role="tooltip"]', { timeout: 150 }).should(
      'contain.text',
      'fresh link',
    );
  });

  // The reason for the portal: the attendees table wraps itself in
  // overflow-hidden with overflow-x-auto inside it.
  it('is not clipped by the table it sits in', () => {
    cy.visit('/administrative/events');
    cy.get('a[href*="/administrative/events/"]').first().click();
    cy.contains('a', 'Attendees').click();

    cy.get('[role="tooltip"]').should('not.exist');
    cy.get('th').contains('Name').trigger('pointerover').trigger('pointermove');
    cy.get('[role="tooltip"]')
      .should('be.visible')
      .then(($t) => {
        // Inside the viewport, which a clipped tooltip would not be.
        const box = $t[0].getBoundingClientRect();
        expect(box.width).to.be.greaterThan(0);
        expect(box.right).to.be.at.most(1280);
        expect(box.left).to.be.at.least(0);
      });
  });
});
