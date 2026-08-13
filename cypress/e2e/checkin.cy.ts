/**
 * The check-in flow on a phone.
 *
 * This is the one flow that is only ever used on a handset — someone scans a QR
 * code at a door and signs with a finger — and until now it had no coverage at
 * all. The signature pad in particular is the riskiest part of the responsive
 * pass: it sizes its canvas from a ResizeObserver, and a canvas whose CSS size
 * and backing size disagree draws the stroke somewhere other than under the
 * finger.
 *
 * Browser calls go to /api/v1/* on the web origin and are proxied to the API
 * (see next.config.ts), so cy.request is same-origin and carries the session
 * cookie — which is how these tests mint a real token instead of stubbing one.
 */

const EVENT_TITLE = 'Cabinet Meeting';

/** Mints a live check-in token for the first event this account can organize. */
function withCheckInToken(run: (token: string) => void) {
  cy.request('/api/v1/events').then((events) => {
    const list = events.body?.data ?? events.body;
    const event =
      list.find((e: { title: string }) => e.title === EVENT_TITLE) ?? list[0];
    // not .to.exist: that is a bare property access, which reads to eslint as
    // an expression that does nothing.
    expect(event, 'a seeded event to check into').to.not.equal(undefined);

    cy.request('POST', `/api/v1/checkin-code/${event.id}`, {}).then((code) => {
      const token = code.body.token;
      expect(token, 'a check-in token').to.be.a('string');
      run(token);
    });
  });
}

describe('Check-in — invalid codes', () => {
  // The failure notices share the Shell card with the real forms, so they
  // exercise its padding without needing a token.
  it('should render the notice inside the viewport at 320px', () => {
    cy.viewport(320, 640);
    cy.visit('/checkin/not-a-real-token', { failOnStatusCode: false });
    cy.contains('Invalid code').should('be.visible');
    cy.assertNoClipping();
  });

  it('should render the notice on a landscape phone', () => {
    cy.viewport(667, 375);
    cy.visit('/checkin/not-a-real-token', { failOnStatusCode: false });
    cy.contains('Invalid code').should('be.visible');
    cy.assertNoClipping();
  });
});

describe('Check-in — signed in', () => {
  beforeEach(() => {
    cy.login('staff@moh.gov.sl', 'Password@123');
  });

  it('should fit the form and signature pad on a 320px screen', () => {
    withCheckInToken((token) => {
      cy.viewport(320, 640);
      cy.visit(`/checkin/${token}`);

      cy.get('input#signedName').should('be.visible');
      cy.get('canvas[aria-label="Signature pad"]').should('be.visible');
      cy.contains('button', 'Clear signature').should('be.visible');
      cy.assertNoClipping();
    });
  });

  it('should size the signature canvas to its container, not past it', () => {
    withCheckInToken((token) => {
      cy.viewport(320, 640);
      cy.visit(`/checkin/${token}`);

      cy.get('canvas[aria-label="Signature pad"]').then(($canvas) => {
        const canvas = $canvas[0] as HTMLCanvasElement;
        const box = canvas.getBoundingClientRect();

        // Inside the viewport, and inside its own card.
        expect(box.right).to.be.at.most(320);
        expect(box.width).to.be.greaterThan(0);

        // The drawing surface and the displayed size must agree, or the
        // pointer coordinates land somewhere other than under the finger.
        // The pad keeps a 1:1 backing ratio deliberately, for payload size.
        expect(canvas.width).to.be.closeTo(box.width, 1);
        expect(canvas.height).to.be.closeTo(box.height, 1);
      });
    });
  });

  it('should resize the canvas when the viewport changes', () => {
    withCheckInToken((token) => {
      cy.viewport(320, 640);
      cy.visit(`/checkin/${token}`);

      cy.get('canvas[aria-label="Signature pad"]')
        .should('be.visible')
        .then(($canvas) => {
          const narrow = ($canvas[0] as HTMLCanvasElement).width;

          // Rotating to landscape gives the card its full max-w-sm width, so
          // the pad must grow with it rather than stay pinned at the old size.
          cy.viewport(667, 375);
          cy.get('canvas[aria-label="Signature pad"]').should(($resized) => {
            const wide = ($resized[0] as HTMLCanvasElement).width;
            expect(wide).to.be.greaterThan(narrow);
            // Never past the pad's own ceiling.
            expect(wide).to.be.at.most(400);
          });
        });
    });
  });

  it('should enable submit only once a signature is drawn', () => {
    withCheckInToken((token) => {
      cy.viewport(375, 812);
      cy.visit(`/checkin/${token}`);

      cy.get('button[type="submit"]').should('be.disabled');

      // Draw with pointer events — the canvas is touch-none precisely so a
      // drag draws instead of scrolling the page.
      cy.get('canvas[aria-label="Signature pad"]')
        .trigger('pointerdown', 40, 40, { eventConstructor: 'PointerEvent' })
        .trigger('pointermove', 90, 70, { eventConstructor: 'PointerEvent' })
        .trigger('pointermove', 140, 45, { eventConstructor: 'PointerEvent' })
        .trigger('pointerup', 140, 45, { eventConstructor: 'PointerEvent' });

      cy.contains('Signature captured').should('be.visible');
      cy.get('button[type="submit"]').should('not.be.disabled');

      // Clear is the only way back from a bad stroke, and it is reached with
      // the same finger that just drew one.
      cy.contains('button', 'Clear signature').click();
      cy.get('button[type="submit"]').should('be.disabled');
    });
  });
});

describe('Check-in code page — organizer', () => {
  beforeEach(() => {
    cy.login('staff@moh.gov.sl', 'Password@123');
  });

  it('should scale the QR code to the screen it is displayed on', () => {
    cy.request('/api/v1/events').then((events) => {
      const list = events.body?.data ?? events.body;
      const event =
        list.find((e: { title: string }) => e.title === EVENT_TITLE) ?? list[0];

      cy.viewport(375, 812);
      cy.visit(`/administrative/events/${event.id}/checkin-code`);

      // At a fixed 256px plus the card's and page's padding this used to be
      // 472px wide on a 375px screen — a quarter of it cut off, on the page
      // whose whole job is being pointed at.
      cy.get('svg').first().then(($svg) => {
        expect($svg[0].getBoundingClientRect().right).to.be.at.most(375);
      });
      cy.assertNoClipping();
    });
  });
});
