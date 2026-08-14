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

export interface Notification {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
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

export const ROLE_LABELS: Record<SystemRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  MINISTER: 'Minister',
  MINISTRY_ADMIN: 'Ministry Admin',
  STAFF: 'Staff',
};

export const SESSION_TIMEOUTS = [
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 7200, label: '2 hours' },
  { value: -1, label: 'Never' },
];

export function initialsOf(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
