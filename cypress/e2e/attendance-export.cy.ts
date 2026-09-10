/**
 * Downloading the attendance register.
 *
 * The two things worth holding onto here are that the file an organizer gets
 * carries the columns the register is supposed to carry, and that somebody
 * from another ministry cannot get it at all — that route used to be open to
 * any signed-in account.
 *
 * Browser calls go to /api/v1/* on the web origin and are proxied to the API
 * (see next.config.ts), so cy.request is same-origin and carries the session
 * cookie.
 */

const WALK_IN = {
  name: 'Register Test Attendee',
  email: 'register-test@moh.gov.sl',
};

/**
 * A meeting this account organizes, so the manage guard lets it record a
 * walk-in.
 *
 * Made rather than found. This used to search the list for one whose organizer
 * matched, which worked while somebody kept a development database stocked and
 * failed the moment that stopped — with a message about an event that does not
 * exist, from a spec that is about downloading a register.
 */
function withOwnEvent(run: (eventId: string) => void) {
  cy.createEvent({ title: `Export test ${Date.now()}` }).then((event) => {
    run(event.id);
  });
}

describe('Attendance export', () => {
  beforeEach(() => {
    cy.login();
  });

  it('offers both formats on the attendees page, and lists the check-in in full', () => {
    withOwnEvent((eventId) => {
      // A record to look at. The desk walk-in is the sparse shape — no title,
      // no organisation, nobody signed — which is the one most likely to
      // render as "undefined" rather than as a blank cell.
      cy.request({
        method: 'POST',
        url: `/api/v1/checkin/${eventId}/manual`,
        body: WALK_IN,
        failOnStatusCode: false,
      });

      cy.visit(`/administrative/events/${eventId}/attendees`);
      cy.contains('button', 'Checked In').click();

      cy.contains('th', 'Organisation').should('be.visible');
      cy.contains('th', 'Location').should('be.visible');
      cy.contains('th', 'Signature').should('be.visible');

      // Scrolled to first: the register table is deliberately overflow-x-auto,
      // so a column can sit outside the viewport at this width and Cypress
      // rightly calls it not visible. Reachable is the property that matters —
      // asserting it merely exists would pass for a cell nobody could ever
      // read.
      cy.contains('td', WALK_IN.name).scrollIntoView().should('be.visible');
      // Nobody signed for a walk-in, and the row has to say so.
      cy.contains('No signature').should('exist');
      /*
       * Rendered text, not the whole document.
       *
       * cy.contains('body', 'undefined') also reads the RSC payload Next
       * serialises into <script> tags, which legitimately contains the literal
       * word — so this reported a field rendering as "undefined" on a page
       * where every empty cell correctly showed a dash. innerText is what a
       * person can actually read.
       */
      cy.get('main').should(($main) => {
        expect(($main[0] as HTMLElement).innerText).to.not.contain('undefined');
      });

      cy.contains('button', 'CSV').should('be.visible');
      cy.contains('button', 'PDF').should('be.visible');
    });
  });

  it('sends a CSV carrying the whole record', () => {
    withOwnEvent((eventId) => {
      cy.request(
        `/api/v1/events/${eventId}/attendance/export?format=csv&set=checked-in`,
      ).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.headers['content-type']).to.contain('text/csv');
        expect(response.headers['content-disposition']).to.contain('attachment');

        const [header] = response.body.split('\r\n');
        for (const column of [
          'Name',
          'Email',
          'Job Title',
          'Organisation',
          'Phone',
          'Method',
          'Signature',
          'Geofence',
        ]) {
          expect(header).to.contain(column);
        }
      });
    });
  });

  it('sends a PDF', () => {
    withOwnEvent((eventId) => {
      cy.request({
        url: `/api/v1/events/${eventId}/attendance/export?format=pdf&set=checked-in`,
        encoding: 'binary',
      }).then((response) => {
        expect(response.status).to.equal(200);
        expect(response.headers['content-type']).to.contain('application/pdf');
        expect(response.body.slice(0, 4)).to.equal('%PDF');
      });
    });
  });

  it('refuses a format or a list it does not know', () => {
    withOwnEvent((eventId) => {
      cy.request({
        url: `/api/v1/events/${eventId}/attendance/export?format=docx&set=checked-in`,
        failOnStatusCode: false,
      })
        .its('status')
        .should('equal', 400);
    });
  });

  it('refuses someone from another ministry', () => {
    withOwnEvent((eventId) => {
      cy.logout();
      cy.login('outsider');

      cy.request({
        url: `/api/v1/events/${eventId}/attendance/export?format=csv&set=checked-in`,
        failOnStatusCode: false,
      })
        .its('status')
        .should('equal', 403);

      // The list itself was the hole the export was gated against; it has to
      // stay shut too.
      cy.request({
        url: `/api/v1/events/${eventId}/checkins`,
        failOnStatusCode: false,
      })
        .its('status')
        .should('equal', 403);
    });
  });
});
