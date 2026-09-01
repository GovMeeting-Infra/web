/**
 * The role vocabulary, kept free of any server-only import.
 *
 * These used to live in lib/session.ts, which imports next/headers — that makes
 * the whole module server-only, so a client component reaching for ADMIN_ROLES
 * broke the build. Splitting the constants out lets the sidebar and the page
 * guards share one definition instead of each keeping their own copy, which is
 * how a nav entry drifts out of step with the page it points at.
 */
export type SystemRole =
  | 'SUPER_ADMIN'
  | 'PLATFORM_ADMIN'
  | 'MINISTER'
  | 'MINISTRY_ADMIN'
  | 'STAFF';

/**
 * Every role that counts as staff-or-above, per PAGES.md's "Staff+".
 *
 * PLATFORM_ADMIN is absent, and the absence is the point: this list gates the
 * meeting surfaces, which are the ones an operations role must never reach.
 * It is no longer true that this covers every signed-in user.
 */
export const STAFF_ROLES: SystemRole[] = [
  'SUPER_ADMIN',
  'MINISTER',
  'MINISTRY_ADMIN',
  'STAFF',
];

/**
 * Ministry administration — and Reports, which is why PLATFORM_ADMIN is not
 * here. Reports export attendance with names, emails and phone numbers.
 */
export const ADMIN_ROLES: SystemRole[] = [
  'SUPER_ADMIN',
  'MINISTER',
  'MINISTRY_ADMIN',
];

/**
 * The roles that belong to no ministry: the platform owner and the engineers
 * who keep the platform running. Gates the operations console, the ministry
 * list and platform settings.
 */
export const PLATFORM_ROLES: SystemRole[] = ['SUPER_ADMIN', 'PLATFORM_ADMIN'];

/**
 * Everyone who may look at the schedule — every role, since a platform admin
 * oversees every ministry's calendar without belonging to one.
 *
 * Distinct from STAFF_ROLES, which gates the surfaces where a meeting is
 * actually run: creating and editing events, minutes, action items, check-in.
 * Looking is not the same permission as touching, and this is the pair of
 * lists that says so.
 */
export const SCHEDULE_VIEWERS: SystemRole[] = [
  'SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'MINISTER',
  'MINISTRY_ADMIN',
  'STAFF',
];

/**
 * Who may reach the user list. Deliberately not ADMIN_ROLES: provisioning
 * accounts is part of an engineer's job, reading a ministry's reports is not,
 * and the two were the same list until there was a role that needed one
 * without the other.
 */
export const USER_ADMIN_ROLES: SystemRole[] = [
  'SUPER_ADMIN',
  'PLATFORM_ADMIN',
  'MINISTER',
  'MINISTRY_ADMIN',
];
