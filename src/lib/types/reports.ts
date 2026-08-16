export interface EventStats {
  total: number;
  upcoming: number;
  past: number;
  byType: { type: string; _count: number }[];
}

export interface AttendanceStats {
  totalCheckIns: number;
  /** 0–1; multiply for a percentage. */
  attendanceRate: number;
}

export interface RoomStats {
  totalRooms: number;
  activeRooms: number;
  bookingsThisMonth: number;
  averageUtilization: number;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  usersByRole: { role: string; count: number }[];
  averageLoginFrequency: number;
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
  roomStats: RoomStats;
  userStats: UserStats;
  actionItemStats: ActionItemStats;
  checkInMethods: CheckInMethods;
  eventsOverTime: EventsOverTimePoint[];
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
