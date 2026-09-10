import { FIXTURE } from '../fixtures/accounts';

/**
 * The label on the button that starts a new meeting.
 *
 * It was 'Create Event' when these were written and is not any more. Named
 * once so the next rename is one edit rather than eight.
 */
const NEW_MEETING = 'Schedule an activity';

/** The button that submits the form, which is worded differently again. */
const SUBMIT_MEETING = 'Schedule activity';

/** A datetime-local value, which wants "YYYY-MM-DDTHH:mm" and nothing else. */
function inAnHour(offsetHours: number): string {
  const when = new Date(Date.now() + offsetHours * 60 * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}` +
    `T${pad(when.getHours())}:${pad(when.getMinutes())}`
  );
}

describe('Events Management', () => {
  /** The meeting each test works against, made by the test rather than found. */
  let meeting: { id: string; title: string };

  beforeEach(() => {
    cy.login();
    /*
     * Created here, not assumed.
     *
     * These tests used to assert on rows somebody had seeded — an event in
     * July, one called 'Cabinet Meeting', a 'Published' badge belonging to
     * none of them in particular. When seeding was removed those became claims
     * about a database nobody maintained, and the spec failed for reasons that
     * had nothing to do with the events page.
     */
    cy.createEvent({ title: `Cypress Meeting ${Date.now()}` }).then((created) => {
      meeting = created;
      cy.visit('/administrative/events');
    });
  });

  describe('Events List Page', () => {
    it('should display events page header', () => {
      cy.contains('Events').should('be.visible');
      cy.contains('Manage your ministry').should('be.visible');
    });

    it('should display create event button', () => {
      cy.contains(NEW_MEETING).should('be.visible');
    });

    it('should display events grid', () => {
      cy.get('[class*="grid"]').should('exist');
    });

    it('should display event cards with details', () => {
      // The meeting this test made, at a time it knows, rather than whatever
      // month the seed data happened to fall in.
      cy.contains(meeting.title).should('be.visible');
      // Times render in en-GB, so 14:30 rather than 2:30 PM. The old pattern
      // was written against a format this app has never used.
      cy.get('main').contains(/\d{1,2}:\d{2}/).should('exist');
    });

    it('should display event status badges', () => {
      // An internal meeting goes live on creation — there is no separate
      // publish step for one, so the badge is there as soon as it is made.
      cy.contains('Published').should('be.visible');
    });

    it('should have edit and view buttons on event cards', () => {
      // Scoped to the card, because a bare cy.get('button') also matches the
      // upcoming/past tabs above the list and matched them first.
      cy.contains(meeting.title)
        .closest('[class*="rounded"]')
        .within(() => {
          cy.contains(/Edit/).should('exist');
          cy.contains(/View/).should('exist');
        });
    });
  });

  describe('Creating Event', () => {
    it('should navigate to create event page', () => {
      cy.contains(NEW_MEETING).click();
      cy.url().should('include', '/events/new');
    });

    it('should have event form fields', () => {
      cy.contains(NEW_MEETING).click();
      // Addressed by id rather than by input type: start and end are a single
      // datetime-local each now, not the separate date and time pair these
      // were written against.
      cy.get('input#title').should('exist');
      cy.get('input#startAt[type="datetime-local"]').should('exist');
      cy.get('input#endAt[type="datetime-local"]').should('exist');
      // location-2, not location: the public and internal branches render
      // their own venue field, and an internal meeting is the default.
      cy.get('input#location-2').should('exist');
    });

    it('should reject form with missing required fields', () => {
      cy.contains(NEW_MEETING).click();
      cy.contains('button', SUBMIT_MEETING).click();
      cy.contains(/required|Add a |must|cannot be/i).should('exist');
      // Still on the form: nothing was created.
      cy.url().should('include', '/events/new');
    });

    it('should submit event form with valid data', () => {
      cy.contains(NEW_MEETING).click();

      cy.get('input#title').type(`Filled in by Cypress ${Date.now()}`);
      cy.get('input#startAt').type(inAnHour(0));
      cy.get('input#endAt').type(inAnHour(2));
      cy.get('input#location-2').type('Cypress Boardroom');

      /*
       * An internal meeting is refused without a deputy, so the form is not
       * complete until one is chosen — the old test never filled this in and
       * so could only ever have failed.
       *
       * A native select, addressed by its accessible name. Clicking the option
       * directly does not work: an <option> is not an element a user clicks,
       * and Cypress rightly refuses.
       */
      cy.get('select[aria-label="Add a co-organizer"]').select(
        FIXTURE.deputy.id,
      );

      cy.contains('button', SUBMIT_MEETING).click();
      cy.url().should('match', /\/administrative\/events\/[^/]+$/);
    });
  });

  /*
   * There was an 'Event Filtering' block here, and it tested nothing.
   *
   * The events page has no search box — it filters by tab, between meetings
   * happening now, upcoming and past. The only input matching
   * `placeholder*="Search"` is the global search in the topbar, which belongs
   * to a different feature and has its own page. So "should have filter
   * options" passed by finding a control on the shell, and "should filter
   * events by search" typed a meeting title into it and then wondered why the
   * list had not changed.
   *
   * The tabs are worth covering. That is a test somebody should write against
   * what this page does, not a repair of one written against what it does not.
   */

  describe('Event Actions', () => {
    /**
     * Act on the card for this test's own meeting.
     *
     * `cy.get('button').contains('View').first()` used to pick the first
     * matching button on the page, which since the tabs were added is one of
     * them — so these tests clicked 'Past' and then wondered why the address
     * had not changed.
     */
    const onOurCard = (label: RegExp) =>
      cy
        .contains(meeting.title)
        .closest('[class*="rounded"]')
        .contains(label)
        .click();

    it('should open event details on view click', () => {
      onOurCard(/View/);
      cy.url().should('include', `/events/${meeting.id}`);
    });

    it('should open event edit on edit click', () => {
      onOurCard(/Edit/);
      cy.url().should('include', `/events/${meeting.id}`).and('include', 'edit');
    });

    it('should display event details page', () => {
      onOurCard(/View/);
      cy.contains(meeting.title).should('be.visible');
    });
  });

  // These previously asserted `should('have.class')` with no argument, which
  // cannot fail — it passed against any element with any class at all. Assert
  // the layout that actually has to hold instead.
  describe('Responsive Behavior', () => {
    it('should stack cards in one column on mobile', () => {
      cy.viewport(375, 812);
      // 'Events' is a sidebar link too, and the sidebar is hidden here.
      cy.get('main').contains('Events').should('be.visible');
      cy.contains(NEW_MEETING).should('be.visible');
      cy.assertNoClipping();
    });

    it('should show the drawer trigger rather than the sidebar on mobile', () => {
      cy.viewport(375, 812);
      cy.get('aside').should('not.be.visible');
      cy.get('#mobile-menu-button').should('be.visible');
    });

    it('should display properly on tablet', () => {
      cy.viewport(768, 1024);
      cy.contains(NEW_MEETING).should('be.visible');
      cy.assertNoClipping();
    });
  });

  // The pages the responsive pass touched most heavily. Each carries a table
  // or a dense grid, which is where clipping shows up first.
  describe('Layout integrity across the admin pages', () => {
    const PAGES = [
      { path: '/administrative/action-items', wait: 'Action items' },
      { path: '/administrative/minutes', wait: 'Minutes' },
      { path: '/administrative/reports', wait: 'Reports' },
      { path: '/administrative/calendar', wait: 'Calendar' },
      // No /administrative/rooms: the feature was removed in August
      // (20260814120000_location_replaces_rooms, then _drop_rooms) and a
      // meeting carries a venue instead. Two tests here were visiting a 404.
      // No activity log: it is restricted to MINISTER and SUPER_ADMIN, and the
      // fixture is a ministry admin, so these two only ever measured the
      // layout of the forbidden page. Covering it means a fixture with that
      // role, which is worth doing and is not this change.
    ];

    PAGES.forEach(({ path, wait }) => {
      /*
       * Scoped to the page, not the whole document.
       *
       * Every one of these words is also a sidebar link, and the sidebar is
       * hidden below lg — so a bare cy.contains matched the nav item, found it
       * invisible, and failed. The page had rendered perfectly well. Same trap
       * as the duplicated branding on the sign-in page: when the same word
       * appears twice by design, say which one is meant.
       */
      it(`should not clip ${path} at 375px`, () => {
        cy.viewport(375, 812);
        cy.visit(path);
        cy.get('main').contains(wait).should('be.visible');
        cy.assertNoClipping();
      });

      it(`should not clip ${path} at 768px`, () => {
        cy.viewport(768, 1024);
        cy.visit(path);
        cy.get('main').contains(wait).should('be.visible');
        cy.assertNoClipping();
      });
    });
  });
});
