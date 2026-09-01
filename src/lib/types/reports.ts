export interface EventStats {
  total: number;
  upcoming: number;
  past: number;
  byType: { type: string; _count: number }[];
}

export interface AttendanceStats {
  totalCheckIns: number;
  /** Invited people who turned up. The numerator behind attendanceRate. */
  invitedWhoCame: number;
  /** Turned up without an invitation, so outside the rate entirely. */
  walkIns: number;
  /** The denominator, so a rate is never shown without the counts behind it. */
  totalInvited: number;
  /** 0–1; multiply for a percentage. Bounded at 1: walk-ins are excluded. */
  attendanceRate: number;
}

/** How much of the attendance record would survive being challenged. */
export interface EvidenceStats {
  total: number;
  signed: number;
  insideArea: number;
  outsideArea: number;
  unverified: number;
  mockFlagged: number;
}

/** The headline figures for one ministry. Platform-wide viewers only. */
export interface MinistryBreakdown {
  ministryId: string;
  name: string;
  meetings: number;
  checkIns: number;
  invited: number;
  attendanceRate: number;
}

/** One window's figures, for comparing against the window before it. */
export interface TrendWindow {
  checkIns: number;
  walkIns: number;
  invited: number;
  meetings: number;
  attendanceRate: number;
}

export interface Trend {
  /** The last 30 days. */
  current: TrendWindow;
  /** The 30 days before those. */
  previous: TrendWindow;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  usersByRole: { role: string; count: number }[];
  averageDaysSinceLastLogin: number;
}

export interface ActionItemStats {
  total: number;
  completed: number;
  inProgress: number;
  /** Includes blocked items, matching how the board groups them. */
  todo: number;
  /** Cuts across todo and inProgress rather than being a bucket of its own. */
  overdue: number;
  cancelled: number;
}

export interface CheckInMethods {
  qr: number;
  manual: number;
  geo: number;
  total: number;
}

export interface EventsOverTimePoint {
  month: string;
  count: number;
}

export interface AnalyticsDashboard {
  eventStats: EventStats;
  attendanceStats: AttendanceStats;
  userStats: UserStats;
  actionItemStats: ActionItemStats;
  checkInMethods: CheckInMethods;
  eventsOverTime: EventsOverTimePoint[];
  /** Last 30 days against the 30 before, so a total has something to mean against. */
  trend: Trend;
  /** Signature capture and geofence outcomes across every check-in. */
  evidence: EvidenceStats;
  /** Present only for a platform-wide viewer. */
  byMinistry?: MinistryBreakdown[];
  scope: 'ministry' | 'all';
  generatedAt: string;
}

/**
 * The three downloads on the reports page.
 *
 * Each carries what it actually contains, because the label alone does not say
 * how far it reaches — every one of these covers the whole ministry rather than
 * the period shown on the page above it.
 */
export const CSV_EXPORTS = [
  {
    dataset: 'events',
    label: 'Events CSV',
    hint: 'One row per meeting across your whole ministry, with how many were invited and how many turned up.',
  },
  {
    dataset: 'attendance',
    label: 'Attendance CSV',
    hint: 'Every check-in across your whole ministry — name, email, title, organisation and how their location was judged.',
  },
  {
    dataset: 'action-items',
    label: 'Action Items CSV',
    hint: 'Every action item from every meeting, with its owner, due date and status.',
  },
] as const;
