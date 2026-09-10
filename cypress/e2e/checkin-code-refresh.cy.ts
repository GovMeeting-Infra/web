/**
 * The check-in code replacing itself.
 *
 * A code lasts five minutes and then stops working. It used to simply die
 * there: an organizer holding a phone up at a door had to notice and press a
 * button, and a queue would carry on scanning something expired in the
 * meantime — a silent, multi-person attendance loss. The page renews it now.
 *
 * The rules worth pinning down are the ones that stop it renewing, because an
 * unattended page minting codes forever is the failure this feature could
 * easily reintroduce: generating was made an explicit act in the first place
 * after an idle tab produced an endless stream of tokens.
 *
 * Everything here is stubbed. A real five-minute wait is not a test, and the
 * clock is what these assertions are actually about.
 */

const EVENT_ID = 'evt-refresh';

/** A published meeting that has not ended, so a code may be generated. */
const OPEN_EVENT = {
  id: EVENT_ID,
  title: 'Cabinet Meeting',
  status: 'PUBLISHED',
  isPublic: false,
  organizerId: 'someone',
  startAt: new Date(Date.now() - 60_000).toISOString(),
  endAt: new Date(Date.now() + 4 * 60 * 60_000).toISOString(),
  coOrganizers: [],
  attendees: [],
};

const codeResponse = (token: string, secondsLeft: number) => ({
  token,
  qrCodeUrl: `http://localhost:3000/checkin/${token}`,
  expiresAt: new Date(Date.now() + secondsLeft * 1000).toISOString(),
  geofence: {
    enabled: true,
    required: false,
    radiusMeters: 100,
    anchorAccuracy: 12,
    anchorSetAt: new Date().toISOString(),
  },
});

describe('Check-in code — automatic refresh', () => {
  /** Codes handed out in order, so a rotation is visible as a new token. */
  let issued: number;

  beforeEach(() => {
    issued = 0;
    cy.login('staff@moh.gov.sl', 'not-a-real-password');

    cy.intercept('GET', `**/api/v1/events/${EVENT_ID}`, {
      statusCode: 200,
      body: OPEN_EVENT,
    });
  });

  /** Serves a code with `secondsLeft` to run, and a fresh 5 minutes on rotate. */
  const serveCode = (secondsLeft: number) => {
    cy.intercept('GET', `**/api/v1/checkin-code/${EVENT_ID}`, (req) =>
      req.reply(codeResponse('token-0', secondsLeft)),
    );
    cy.intercept('POST', `**/api/v1/checkin-code/${EVENT_ID}`, (req) => {
      issued += 1;
      req.reply(codeResponse(`token-${issued}`, 300));
    }).as('rotate');
  };

  it('replaces a code about to expire without anyone pressing anything', () => {
    // Inside the threshold the page rotates at, so this happens on the first
    // tick rather than after a wait the test would have to sit through.
    serveCode(5);
    cy.visit(`/administrative/events/${EVENT_ID}/checkin-code`);

    cy.wait('@rotate').its('request.body').should('deep.equal', {
      rotate: true,
    });

    // The new code is the one on screen, and the countdown has started again.
    cy.contains('token-1').should('be.visible');
    cy.contains('Expires in 4:').should('be.visible');
  });

  it('does not move the check-in area when it refreshes', () => {
    serveCode(5);
    cy.visit(`/administrative/events/${EVENT_ID}/checkin-code`);

    // Coordinates in this request would let a code refreshed from the corridor
    // drag the geofence along behind whoever is holding the phone.
    cy.wait('@rotate').then(({ request }) => {
      expect(request.body).to.not.have.property('lat');
      expect(request.body).to.not.have.property('lng');
    });
  });

  it('asks for one replacement, not one per second', () => {
    serveCode(5);
    cy.visit(`/administrative/events/${EVENT_ID}/checkin-code`);

    cy.wait('@rotate');
    // The threshold stays true for several ticks of a one-second countdown, so
    // the guard against re-asking is the whole difference between renewing a
    // code and hammering the endpoint.
    cy.wait(3000);
    cy.then(() => expect(issued).to.equal(1));
  });

  it('leaves a code with time left alone', () => {
    serveCode(280);
    cy.visit(`/administrative/events/${EVENT_ID}/checkin-code`);

    cy.contains('Expires in 4:').should('be.visible');
    cy.wait(3000);
    cy.then(() => expect(issued).to.equal(0));
  });

  it('stops for good once check-in is closed', () => {
    serveCode(5);
    cy.intercept('DELETE', `**/api/v1/checkin-code/${EVENT_ID}`, {
      statusCode: 204,
      body: '',
    }).as('close');

    cy.visit(`/administrative/events/${EVENT_ID}/checkin-code`);
    cy.wait('@rotate');

    // From here the code on screen has a full five minutes, so nothing would
    // rotate on its own anyway — what matters is that closing check-in is not
    // undone by the page a moment later.
    cy.on('window:confirm', () => true);
    cy.contains('button', 'Close check-in').click();
    cy.wait('@close');

    cy.contains('Check-in closed').should('be.visible');
    cy.wait(3000);
    // Still the one rotation from before the close, never a replacement for
    // the code the organizer just revoked.
    cy.then(() => expect(issued).to.equal(1));
  });

  it('gives up after the server refuses, rather than retrying every second', () => {
    cy.intercept('GET', `**/api/v1/checkin-code/${EVENT_ID}`, (req) =>
      req.reply(codeResponse('token-0', 5)),
    );
    cy.intercept('POST', `**/api/v1/checkin-code/${EVENT_ID}`, (req) => {
      issued += 1;
      req.reply({
        statusCode: 400,
        body: { message: 'This meeting has ended' },
      });
    }).as('refused');

    cy.visit(`/administrative/events/${EVENT_ID}/checkin-code`);
    cy.wait('@refused');

    cy.contains('This meeting has ended').should('be.visible');
    cy.contains('Automatic refreshing stopped').should('be.visible');

    // One refusal, not one a second for as long as the tab stays open.
    cy.wait(3000);
    cy.then(() => expect(issued).to.equal(1));
  });

  it('does not refresh an ended meeting at all', () => {
    cy.intercept('GET', `**/api/v1/events/${EVENT_ID}`, {
      statusCode: 200,
      body: { ...OPEN_EVENT, endAt: new Date(Date.now() - 60_000).toISOString() },
    });
    serveCode(5);

    cy.visit(`/administrative/events/${EVENT_ID}/checkin-code`);

    // The server refuses a code for a meeting that is over, so asking would
    // only produce an error next to a button already disabled for saying so.
    cy.contains('This code has expired').should('be.visible');
    cy.wait(3000);
    cy.then(() => expect(issued).to.equal(0));
  });
});
