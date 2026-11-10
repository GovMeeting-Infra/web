/**
 * People who have been invited to the platform but have not accepted cannot
 * sign in, so the pickers for in-app roles leave them out. These cover the
 * page's side of that: what the event form says when that leaves nobody, and
 * that the picker finds a full name whichever way round it is typed.
 *
 * The API is stubbed. Signs in as a minister: set CYPRESS_MINISTER_PASSWORD
 * to the local password for minister@moh.gov.sl.
 */

describe('Pickers and accepted invitations', () => {
  beforeEach(() => {
    cy.login(
      'minister@moh.gov.sl',
      Cypress.env('MINISTER_PASSWORD') ?? 'not-a-real-password',
    );
  });

  it('explains an empty co-organizer list instead of showing nothing', () => {
    cy.intercept('GET', '**/api/v1/events/co-organizer-candidates', []).as(
      'candidates',
    );
    cy.visit('/administrative/events/new');
    cy.wait('@candidates');

    cy.contains('has accepted their invitation to the platform yet');
    // A minister can re-send invitations, so is pointed at where to do it.
    cy.contains('a', 'Users').should(
      'have.attr',
      'href',
      '/administrative/admin/users',
    );
  });

  it('says nothing extra when there is somebody to choose', () => {
    cy.intercept('GET', '**/api/v1/events/co-organizer-candidates', [
      { id: 'u2', name: 'Fatmata Sesay', email: 'f.sesay@moh.gov.sl', jobTitle: null },
    ]).as('candidates');
    cy.visit('/administrative/events/new');
    cy.wait('@candidates');

    cy.get('select[aria-label="Add a co-organizer"]').should(
      'contain',
      'Fatmata Sesay',
    );
    cy.contains('has accepted their invitation to the platform yet').should(
      'not.exist',
    );
  });

  it('finds a full name typed the other way round', () => {
    cy.intercept('GET', '**/api/v1/events/co-organizer-candidates', [
      { id: 'u2', name: 'Fatmata Sesay', email: 'f.sesay@moh.gov.sl', jobTitle: null },
    ]);
    cy.intercept('GET', '**/api/v1/users/directory/people?*', [
      {
        id: 'sd1',
        name: 'Abdul Mansaray',
        email: 'a.mansaray@moh.gov.sl',
        jobTitle: null,
        kind: 'staff',
      },
    ]).as('people');
    cy.visit('/administrative/events/new');

    cy.get('input[role="combobox"]').last().type('Mansaray Abdul');
    cy.wait('@people');
    cy.contains('[role="option"]', 'Abdul Mansaray');
  });
});
