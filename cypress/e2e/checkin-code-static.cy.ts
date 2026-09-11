/**
 * One check-in code per meeting, and nothing that replaces it on a timer.
 *
 * The code used to last five minutes and be replaced over and over — first by
 * hand, then by the page itself. Both put the organizer in charge of a clock:
 * whoever arrived while the screen showed a dead code could not get in, and
 * somebody had to be watching for that not to happen. People arrive late, so
 * they were.
 *
 * This file replaces checkin-code-refresh.cy.ts, which asserted the rotation.
 * What matters now is the opposite — that nothing is minted without being
 * asked for — so these hold the endpoint to silence.
 */

const EVENT_ID = 'evt-static';

/** A published meeting, still an hour from its end. */
const OPEN_EVENT = {
  id: EVENT_ID,
  title: 'Cabinet Meeting',
  status: 'PUBLISHED',
  isPublic: false,
  organizerId: 'someone',
  startAt: new Date(Date.now() - 60_000).toISOString(),
  endAt: new Date(Date.now() + 60 * 60_000).toISOString(),
  coOrganizers: [],
  attendees: [],
};

/** The code the API hands back: alive until the meeting ends. */
const codeResponse = (token: string, endsInMs: number) => ({
  token,
  qrCodeUrl: `http://localhost:3000/checkin/${token}`,
  expiresAt: new Date(Date.now() + endsInMs).toISOString(),
  geofence: {
    enabled: true,
    required: false,
    radiusMeters: 100,
    anchorAccuracy: 12,
    anchorSetAt: new Date().toISOString(),
  },
});

describe('Check-in code — one per meeting', () => {
  let issued: number;

  beforeEach(() => {
    issued = 0;
    cy.login('staff@moh.gov.sl', 'not-a-real-password');

    cy.intercept('GET', `**/api/v1/events/${EVENT_ID}`, {
      statusCode: 200,
      body: OPEN_EVENT,
    });
    cy.intercept('GET', `**/api/v1/checkin-code/${EVENT_ID}`, (req) =>
      req.reply(codeResponse('token-0', 60 * 60_000)),
    );
    cy.intercept('POST', `**/api/v1/checkin-code/${EVENT_ID}`, (req) => {
      issued += 1;
      req.reply(codeResponse(`token-${issued}`, 60 * 60_000));
    }).as('issue');
  });

  it('leaves the code alone while the meeting runs', () => {
    cy.visit(`/administrative/events/${EVENT_ID}/checkin-code`);
    cy.contains('token-0').should('be.visible');

    // The heart of it. The page used to ask for a replacement on a threshold;
    // now nothing asks unless a person does.
    cy.wait(4000);
    cy.then(() => expect(issued).to.equal(0));
    cy.contains('token-0').should('be.visible');
  });

  it('does not count down', () => {
    cy.visit(`/administrative/events/${EVENT_ID}/checkin-code`);

    // A ticking clock is what made this the organizer's problem. It says when
    // check-in closes instead, once.
    cy.contains('Expires in').should('not.exist');
    cy.contains(/Works until the meeting ends|Works for the whole meeting/).should(
      'be.visible',
    );
  });

  it('leaves a code near the end of the meeting alone too', () => {
    // The old reuse rule minted a new code once under a minute remained, so
    // the last minute of every meeting quietly issued one nobody asked for.
    cy.intercept('GET', `**/api/v1/checkin-code/${EVENT_ID}`, (req) =>
      req.reply(codeResponse('token-0', 30_000)),
    );

    cy.visit(`/administrative/events/${EVENT_ID}/checkin-code`);
    cy.contains('token-0').should('be.visible');
    cy.wait(3000);
    cy.then(() => expect(issued).to.equal(0));
  });

  it('replaces the code only when asked, and only once confirmed', () => {
    cy.visit(`/administrative/events/${EVENT_ID}/checkin-code`);
    cy.contains('token-0').should('be.visible');

    // Backing out of the confirmation must not revoke a code people may be
    // part way through scanning.
    cy.on('window:confirm', () => false);
    cy.contains('button', 'New code').click();
    cy.then(() => expect(issued).to.equal(0));
  });

  it('issues a new one when the replacement is confirmed', () => {
    cy.visit(`/administrative/events/${EVENT_ID}/checkin-code`);
    cy.contains('token-0').should('be.visible');

    cy.on('window:confirm', () => true);
    cy.contains('button', 'New code').click();

    cy.wait('@issue').its('request.body').should('deep.equal', { rotate: true });
    cy.contains('token-1').should('be.visible');
  });

  it('does not move the check-in area when a code is replaced', () => {
    cy.visit(`/administrative/events/${EVENT_ID}/checkin-code`);
    cy.contains('token-0').should('be.visible');

    cy.on('window:confirm', () => true);
    cy.contains('button', 'New code').click();

    // Coordinates here would let a code replaced from the corridor drag the
    // geofence along behind whoever is holding the phone.
    cy.wait('@issue').then(({ request }) => {
      expect(request.body).to.not.have.property('lat');
      expect(request.body).to.not.have.property('lng');
    });
  });

  it('covers the code once the meeting is over', () => {
    cy.intercept('GET', `**/api/v1/events/${EVENT_ID}`, {
      statusCode: 200,
      body: { ...OPEN_EVENT, endAt: new Date(Date.now() - 60_000).toISOString() },
    });
    cy.intercept('GET', `**/api/v1/checkin-code/${EVENT_ID}`, (req) =>
      req.reply(codeResponse('token-0', -60_000)),
    );

    cy.visit(`/administrative/events/${EVENT_ID}/checkin-code`);

    // A dead code looks exactly like a live one, and an organizer holding the
    // screen up cannot tell — so it is covered rather than left to be scanned.
    cy.contains('Check-in has ended').should('be.visible');
    cy.wait(3000);
    cy.then(() => expect(issued).to.equal(0));
  });
});
