import type { SystemRole } from '@/lib/roles';

/**
 * Bumped when the tour changes materially. Stored per user in
 * UserPreferences.tourCompletedVersion — a version rather than a boolean, so a
 * rewritten tour can be shown again without clearing the column by hand.
 */
export const TOUR_VERSION = '1';

export interface TourStep {
  /**
   * The page this step belongs to. Consecutive steps sharing a route are shown
   * together; crossing to a new route navigates there first.
   */
  route: string;
  /**
   * CSS selector for the element to highlight. Omit for a centered card with no
   * target, used for the opening and closing steps.
   *
   * A step whose element never appears is skipped rather than left hanging: the
   * pages behind these selectors load asynchronously, and a fresh deployment
   * has empty lists.
   */
  element?: string;
  title: string;
  description: string;
}

const DASHBOARD = '/administrative/dashboard';
const EVENTS = '/administrative/events';
const MINUTES = '/administrative/minutes';
const ACTION_ITEMS = '/administrative/action-items';
const USERS = '/administrative/admin/users';
const MINISTRIES = '/administrative/admin/ministries';
const ACTIVITY = '/administrative/activity-log';

/** Steps everyone gets, in order: orientation, then the core working flows. */
function coreSteps(firstName: string): TourStep[] {
  return [
    {
      route: DASHBOARD,
      title: `Welcome, ${firstName}`,
      description:
        'A two-minute walk through the parts of the platform you will use. You can leave at any time with Escape, and start it again from the Help page.',
    },
    {
      route: DASHBOARD,
      element: '[data-tour="dashboard-stats"]',
      title: 'Your dashboard',
      description:
        'Where your week stands at a glance — meetings coming up, attendance recorded, and action items waiting on you.',
    },
    {
      route: DASHBOARD,
      element: '[data-tour="nav-calendar"]',
      title: 'The calendar',
      description:
        'Every meeting you can see, in one place. Internal meetings sit alongside public activities, which also appear on the public calendar outside the platform.',
    },
    {
      route: EVENTS,
      element: 'h1',
      title: 'Meetings',
      description:
        'Every meeting in your ministry. Open one to manage its attendees, minutes and check-in.',
    },
    {
      route: EVENTS,
      element: '[data-tour="events-create"]',
      title: 'Creating a meeting',
      description:
        'Set the time, where it is being held and who is invited. A meeting can repeat, and each occurrence is then managed on its own.',
    },
    {
      route: EVENTS,
      element: 'h1',
      title: 'Checking people in',
      description:
        'Open a meeting and choose QR Code. Attendees scan it, type their name and sign on screen. The code changes every five minutes, so a screenshot is no use — and the check-in area is anchored to wherever you are standing when you generate it, within 100 metres.',
    },
    {
      route: MINUTES,
      element: 'h1',
      title: 'Minutes',
      description:
        'Minutes are written here, then published to everyone who attended. You have two days to edit them afterwards; past that, a ministry admin can still make corrections.',
    },
    {
      route: ACTION_ITEMS,
      element: 'h1',
      title: 'Action items',
      description:
        'Everything assigned out of a meeting, on one board across all your meetings. Drag an item to move it along, and owners are reminded the day before it is due.',
    },
  ];
}

const CLOSING: TourStep = {
  route: ACTION_ITEMS,
  title: 'That is the tour',
  description:
    'The Help page has this tour again whenever you want it, along with more detail on each area.',
};

/** Administration steps, for the roles that have those pages. */
function adminSteps(role: SystemRole): TourStep[] {
  const steps: TourStep[] = [
    {
      route: USERS,
      element: 'h1',
      title: 'People',
      description:
        role === 'SUPER_ADMIN'
          ? 'Everyone on the platform, across every ministry. New people are emailed a link to set their own password — you never handle it.'
          : 'The people in your ministry. New people are emailed a link to set their own password — you never handle it.',
    },
  ];

  if (role === 'MINISTER' || role === 'SUPER_ADMIN') {
    steps.push({
      route: ACTIVITY,
      element: 'h1',
      title: 'The activity log',
      description:
        role === 'SUPER_ADMIN'
          ? 'Every recorded action across all ministries, filterable by ministry. The log is append-only: entries are never edited or removed.'
          : 'Every recorded action in your ministry. The log is append-only: entries are never edited or removed.',
    });
  }

  if (role === 'SUPER_ADMIN') {
    steps.push({
      route: MINISTRIES,
      element: 'h1',
      title: 'Ministries',
      description:
        'Add a ministry and its first administrator together, so it has someone who can sign in from the start. Deactivating a ministry signs out everyone in it and blocks them from returning.',
    });
  }

  return steps;
}

/**
 * The tour for a given role.
 *
 * Built per role rather than filtered at runtime: the sidebar only renders what
 * a role can reach, and a shared list would point at entries that are not
 * there. The closing step moves to the end of whatever the last section is.
 */
export function stepsForRole(role: SystemRole, firstName: string): TourStep[] {
  const core = coreSteps(firstName);

  if (role === 'STAFF') {
    return [...core, CLOSING];
  }

  const admin = adminSteps(role);
  return [...core, ...admin, { ...CLOSING, route: admin[admin.length - 1].route }];
}
