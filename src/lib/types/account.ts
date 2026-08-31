import type { SystemRole } from './events';

export interface ProfileStats {
  organizedEvents: number;
  attendedEvents: number;
  actionItems: number;
  upcomingEvents: number;
}

export interface MyProfile {
  id: string;
  email: string;
  name: string;
  image: string | null;
  jobTitle: string | null;
  /** Work phone. Stamped onto attendance records at check-in. */
  phone: string | null;
  systemRole: SystemRole;
  ministryId: string | null;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  ministry: { id: string; name: string } | null;
  stats: ProfileStats;
}

export interface UserPreferences {
  emailNotifications: boolean;
  minutesNotifications: boolean;
  meetingReminders: boolean;
  actionItemNotifications: boolean;
  theme: string;
  compactMode: boolean;
  /** Seconds; -1 means never. */
  sessionTimeout: number;
  /** Guided tour version this user finished or dismissed; null if never shown. */
  tourCompletedVersion: string | null;
}

export type NotificationType =
  | 'MINUTES_PUBLISHED'
  | 'ACTION_ITEM_ASSIGNED'
  | 'ACTION_ITEM_STATUS_CHANGED'
  | 'ACTION_ITEM_DUE_SOON'
  | 'ACTION_ITEM_WEEKLY_DIGEST'
  | 'MEETING_INVITATION'
  | 'MEETING_CHANGED'
  | 'MEETING_CANCELLED'
  | 'MEETING_REMINDER';

export interface Notification {
  id: string;
  /**
   * What kind of thing this is. The server has always sent it — the list query
   * uses no `select` — and this interface used to drop it, along with
   * entityType and entityId, so nine kinds of message rendered as one card.
   */
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
  entityType: string | null;
  /** The specific record, so a notification can open the item and not the board. */
  entityId: string | null;
}

/** One page of notifications, with the total behind it. */
export interface NotificationPage {
  items: Notification[];
  total: number;
  skip: number;
  limit: number;
}

export interface SearchResults {
  query: string;
  tooShort: boolean;
  events: {
    id: string;
    title: string;
    startAt: string;
    organizer: { name: string; email: string } | null;
  }[];
  minutes: {
    id: string;
    status: string;
    snippet: string;
    event: { id: string; title: string };
  }[];
  people: { id: string; name: string; email: string; jobTitle: string | null }[];
}

/**
 * Both platform roles read the same on purpose. The owner's rows are filtered
 * out of the user list server-side, so the only place its own label is rendered
 * is its own user menu — where "Platform Admin" is true enough and tells a
 * reader nothing about a role that is not theirs to know about.
 */
export const ROLE_LABELS: Record<SystemRole, string> = {
  SUPER_ADMIN: 'Platform Admin',
  PLATFORM_ADMIN: 'Platform Admin',
  MINISTER: 'Minister',
  MINISTRY_ADMIN: 'Ministry Admin',
  STAFF: 'Staff',
};

/**
 * What each role can actually do, for the person whose account it is.
 *
 * The role was rendered as a bare word beside a free-text job title, which told
 * someone in their first week nothing about the difference between the two.
 */
export const ROLE_DESCRIPTIONS: Record<SystemRole, string> = {
  SUPER_ADMIN: 'You can administer every ministry on the platform.',
  PLATFORM_ADMIN:
    'You keep the platform running and set up ministries and accounts. Meetings and their records belong to the ministries.',
  MINISTER: 'You can see everything in your ministry and manage its people.',
  MINISTRY_ADMIN: 'You can manage meetings, people and reports for your ministry.',
  STAFF: 'You can run your own meetings, check in, and keep minutes.',
};

export function initialsOf(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
