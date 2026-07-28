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
  | 'MINISTER'
  | 'MINISTRY_ADMIN'
  | 'STAFF';

/** Every role that counts as staff-or-above, per PAGES.md's "Staff+". */
export const STAFF_ROLES: SystemRole[] = [
  'SUPER_ADMIN',
  'MINISTER',
  'MINISTRY_ADMIN',
  'STAFF',
];

export const ADMIN_ROLES: SystemRole[] = [
  'SUPER_ADMIN',
  'MINISTER',
  'MINISTRY_ADMIN',
];
