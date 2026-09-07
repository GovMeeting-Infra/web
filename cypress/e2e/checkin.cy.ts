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

/**
 * Draw a stroke on the signature pad.
 *
 * Three details, each of which silently produces an empty pad:
 *
 * Mouse events, not pointer events. The canvas is touch-none so a drag draws
 * rather than scrolling, which makes pointer events the obvious guess — but
 * the signature_pad underneath listens for mousedown/mousemove/mouseup and
 * touchstart/touchmove/touchend, and nothing else. Pointer events land on the
 * canvas and are never heard.
 *
 * eventConstructor, because Cypress otherwise dispatches a plain Event, which
 * carries no clientX or clientY — the listener runs and has nowhere to draw.
 *
 * buttons: 1, because the library ignores a move with no button held. That is
 * how it tells a drag from a hover.
 *
 * All three together read as "the signature pad is broken", which is what the
 * old specs appeared to be reporting and was never true.
 */
function drawSignature(): void {
  const held = {
    eventConstructor: 'MouseEvent',
    buttons: 1,
    button: 0,
  } as const;

  cy.get('canvas[aria-label^="Signature pad"]')
    .trigger('mousedown', 40, 40, held)
    .trigger('mousemove', 90, 70, held)
    .trigger('mousemove', 140, 45, held)
    .trigger('mouseup', 140, 45, {
      eventConstructor: 'MouseEvent',
      buttons: 0,
      button: 0,
    });
}

/**
 * Mints a live check-in token for a meeting this spec created.
 *
 * It used to look for a seeded 'Cabinet Meeting' and fall back to whatever was
 * first in the list. When seeding was removed that became a search for a row
 * nobody maintained, and every test here failed on "a seeded event to check
 * into" — a spec asserting on the state of somebody's development database
 * rather than on the application.
 *
 * A meeting made here is also a meeting whose properties are known, so the
 * assertions below can be about check-in rather than about whatever happened
 * to be lying around.
 */
function withCheckInToken(run: (token: string) => void) {
  cy.createEvent().then((event) => {
    /*
     * A code cannot be minted without a position.
     *
     * The check-in area is anchored to wherever the organizer stood when they
     * generated the code, so the endpoint refuses a request that carries no
     * fix, or one too vague to anchor from — the accuracy gate is 50m. An
     * empty body used to be enough and has not been for some time.
     */
    cy.request('POST', `/api/v1/checkin-code/${event.id}`, {
      lat: 8.4657,
      lng: -13.2317,
      gpsAccuracy: 10,
    }).then((code) => {
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
    cy.login();
  });

  it('should fit the form and signature pad on a 320px screen', () => {
    withCheckInToken((token) => {
      cy.viewport(320, 640);
      cy.visit(`/checkin/${token}`);

      cy.get('input#signedName').should('be.visible');
      cy.get('canvas[aria-label^="Signature pad"]').should('be.visible');
      cy.contains('button', 'Clear signature').should('be.visible');
      cy.assertNoClipping();
    });
  });

  it('should size the signature canvas to its container, not past it', () => {
    withCheckInToken((token) => {
      cy.viewport(320, 640);
      cy.visit(`/checkin/${token}`);

      /*
       * should, not then.
       *
       * The pad starts at its 400px ceiling and shrinks to fit once a
       * ResizeObserver has measured the card, so a `.then` runs against the
       * first paint and reads a width that was never on screen — it reported
       * an overflow of exactly the initial size, which reads like a real
       * responsive bug and is not one. `.should` retries until the observer
       * has settled.
       */
      cy.get('canvas[aria-label^="Signature pad"]').should(($canvas) => {
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

      // Settled at the narrow size first — otherwise "it grew" can be
      // satisfied by the pad simply not having shrunk yet.
      cy.get('canvas[aria-label^="Signature pad"]')
        .should('be.visible')
        .and(($canvas) => {
          expect(($canvas[0] as HTMLCanvasElement).width).to.be.lessThan(400);
        });

      cy.get('canvas[aria-label^="Signature pad"]').then(($canvas) => {
        const narrow = ($canvas[0] as HTMLCanvasElement).width;

        // Rotating to landscape gives the card its full max-w-sm width, so
        // the pad must grow with it rather than stay pinned at the old size.
        cy.viewport(667, 375);
        cy.get('canvas[aria-label^="Signature pad"]').should(($resized) => {
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

      drawSignature();

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
    cy.login();
  });

  it('should scale the QR code to the screen it is displayed on', () => {
    cy.createEvent().then((event) => {
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

/**
 * What someone sees when their phone will not share a location.
 *
 * The failure that prompted this could not be reproduced by reading the code:
 * three unrelated things — a blocked permission, a fix the server called too
 * vague, and a rate limit — all reached the attendee as one flat sentence. The
 * part worth pinning down is that a blocked permission now produces
 * instructions for the phone in the person's hand, and a way back.
 */
describe('Check-in — location refused', () => {
  beforeEach(() => {
    cy.login();
  });

  /** Every route to a position fails as blocked, however the page asks. */
  const denyLocation = (win: Window) => {
    const denied = (_ok: unknown, fail: (e: unknown) => void) =>
      fail({ code: 1, PERMISSION_DENIED: 1, TIMEOUT: 3, message: 'denied' });

    cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake(denied);
    cy.stub(win.navigator.geolocation, 'watchPosition').callsFake(denied);
  };

  it('tells a blocked attendee which setting to change, and offers a retry', () => {
    withCheckInToken((token) => {
      cy.viewport(320, 640);
      cy.visit(`/checkin/${token}`, { onBeforeLoad: denyLocation });

      cy.get('input#signedName').type('Aminata Kamara');
      drawSignature();

      cy.get('button[type="submit"]').click();

      // Not the old flat sentence: a named remedy and a way to act on it.
      cy.contains('Allow location').should('be.visible');
      cy.contains('button', 'Try again').should('be.visible');
      // Nobody should be left with no route at all.
      cy.contains('check you in at the desk').should('exist');
      cy.assertNoClipping();
    });
  });

  it('lets someone test their location before filling anything in', () => {
    withCheckInToken((token) => {
      cy.viewport(320, 640);
      cy.visit(`/checkin/${token}`, { onBeforeLoad: denyLocation });

      // The only pre-flight an iPhone can have: WebKit will not answer a
      // permissions query, so asking for a position is the sole way to know.
      cy.contains('button', 'Check location access first').click();
      cy.contains('button', 'Try again').should('be.visible');
    });
  });
});
