/**
 * The events list against an API that is behind this build.
 *
 * web and server are separate repositories with separate deployments, so a
 * page that requires a field the API has only just started sending will meet
 * one that does not. That happened: the card began reading `coOrganizers` to
 * decide whether to offer Edit, the web deploy landed first, and reading
 * `.some` off undefined threw during render — so every tab holding an event
 * was replaced by the generic "something went wrong" screen while the API sat
 * there answering 200. The tab that happened to be empty still worked, which
 * is why it looked intermittent.
 *
 * A list card is the last thing that should be able to take a page down. These
 * serve the older response shape deliberately and assert the page survives it.
 */

const LEGACY_EVENT_ID = 'evt-legacy';

/** The list response as the API returned it before coOrganizers existed. */
const legacyEvent = {
  id: LEGACY_EVENT_ID,
  title: 'Quarterly Review',
  description: null,
  isPublic: false,
  type: 'MEETING',
  startAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
  endAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
  venueName: 'Youyi Building',
  status: 'PUBLISHED',
  colorCategory: null,
  organizer: { id: 'someone-else', name: 'Salima Bah' },
  _count: { attendees: 4, attendances: 3 },
};

describe('Events list — an API without coOrganizers', () => {
  beforeEach(() => {
    cy.login('staff@moh.gov.sl', 'not-a-real-password');

    cy.intercept('GET', '**/api/v1/events?*', (req) => {
      const past = req.query.timeframe === 'past';
      req.reply({
        statusCode: 200,
        body: { data: past ? [legacyEvent] : [], total: past ? 1 : 0 },
      });
    }).as('list');
  });

  it('renders the card instead of the error screen', () => {
    cy.visit('/administrative/events');

    // The tab the events are under, which is the one that used to break — the
    // default tab was empty, so the page looked fine until it was clicked off.
    cy.contains('button', 'Past').click();

    cy.contains('Quarterly Review').should('be.visible');
    cy.contains('Something went wrong').should('not.exist');
  });

  it('still offers View when it cannot work out Edit', () => {
    cy.visit('/administrative/events');
    cy.contains('button', 'Past').click();

    // Losing one button is the acceptable cost of a field the page cannot
    // read. Losing the page is not, and neither is a route out of the list.
    cy.contains('Quarterly Review')
      .parents('div')
      .contains('View')
      .should('be.visible');
  });

  it('does not crash on any tab', () => {
    cy.visit('/administrative/events');

    for (const tab of ['Happening now', 'Upcoming', 'Past']) {
      cy.contains('button', tab).click();
      cy.contains('Something went wrong').should('not.exist');
    }
  });
});
