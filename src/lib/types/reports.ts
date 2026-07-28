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
  todo: number;
  overdue: number;
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

export const CSV_EXPORTS = [
  { dataset: 'events', label: 'Events CSV' },
  { dataset: 'attendance', label: 'Attendance CSV' },
  { dataset: 'action-items', label: 'Action Items CSV' },
] as const;
