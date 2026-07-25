export type SystemRole = 'SUPER_ADMIN' | 'MINISTER' | 'MINISTRY_ADMIN' | 'STAFF';

export type EventType =
  | 'MEETING'
  | 'CONFERENCE'
  | 'APPOINTMENT'
  | 'TRAINING'
  | 'WORKSHOP'
  | 'LAUNCH'
  | 'OTHER';

export type EventScope = 'OFFICIAL' | 'TEAM';
export type EventClassification = 'PUBLIC' | 'RESTRICTED';
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED';

export type Frequency =
  | 'DAILY'
  | 'WEEKLY'
  | 'WEEKDAYS'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'YEARLY';

export type EndType = 'COUNT' | 'UNTIL' | 'NEVER';

export interface EventSeries {
  id: string;
  frequency: Frequency;
  interval: number;
  endType: EndType;
  count: number | null;
  until: string | null;
  createdAt: string;
}

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  WEEKDAYS: 'Every weekday',
  BIWEEKLY: 'Every two weeks',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  CANCELLED: 'Cancelled',
};
export type CheckInMethod = 'QR' | 'MANUAL' | 'GEO';
export type MinutesStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type PointType = 'ACTION_POINT' | 'AGREED' | 'DECISION';
export type ActionItemStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'CANCELLED';
export type AttendeeStatus = 'INVITED' | 'CONFIRMED' | 'DECLINED' | 'NO_RESPONSE';
export type RSVPStatus = 'CONFIRMED' | 'DECLINED';

export interface CoOrganizerCandidate {
  id: string;
  name: string | null;
  email: string;
  jobTitle: string | null;
}

export interface RoomSummary {
  id: string;
  name: string;
  location: string;
  capacity: number;
  amenities: string[];
  _count?: { bookings: number; events: number };
}

export interface EventListItem {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  type: EventType;
  startAt: string;
  endAt: string;
  venueName: string | null;
  status: EventStatus;
  colorCategory: string | null;
  organizer: { id: string; name: string } | null;
  room: { id: string; name: string } | null;
  _count: { attendees: number };
}

export interface EventListResponse {
  data: EventListItem[];
  total: number;
}

export interface EventCoOrganizer {
  id: string;
  eventId: string;
  userId: string;
  addedAt: string;
  user: { id: string; name: string; email: string };
}

export interface EventAttendee {
  id: string;
  eventId: string;
  userId: string | null;
  externalName: string | null;
  externalEmail: string | null;
  status: AttendeeStatus;
  respondedAt: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
}

/** Display name for an attendee row (registered user or external invitee). */
export function attendeeName(a: EventAttendee): string {
  return a.user?.name ?? a.externalName ?? 'Unknown';
}

/** Display email for an attendee row, if any. */
export function attendeeEmail(a: EventAttendee): string | null {
  return a.user?.email ?? a.externalEmail ?? null;
}

export interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  type: EventType;
  scope: EventScope | null;
  classification: EventClassification | null;
  colorCategory: string | null;
  startAt: string;
  endAt: string;
  venueName: string | null;
  venueLat: number | null;
  venueLng: number | null;
  geofenceRadius: number;
  bannerImage: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  externalUrl: string | null;
  status: EventStatus;
  publishedAt: string | null;
  ministryId: string;
  organizerId: string | null;
  roomId: string | null;
  organizer: { id: string; name: string; email: string } | null;
  coOrganizers: EventCoOrganizer[];
  attendees: EventAttendee[];
  minutes: { id: string; status: MinutesStatus } | null;
  room: RoomSummary | null;
  seriesId: string | null;
  series: EventSeries | null;
  invitedMinistries: { id: string; name: string; code: string }[];
}

export interface CreateEventInput {
  title: string;
  description?: string;
  isPublic: boolean;
  type?: EventType;
  scope?: EventScope;
  classification?: EventClassification;
  startAt: string;
  endAt: string;
  venueName?: string;
  roomId?: string;
  colorCategory?: string;
  coOrganizerIds?: string[];
  ministryId?: string;
  bannerImage?: string;
  contactEmail?: string;
  contactPhone?: string;
  externalUrl?: string;
  invitedMinistryIds?: string[];
  inviteeUserIds?: string[];
  inviteeExternals?: { name: string; email?: string }[];
}

export type UpdateEventInput = Partial<CreateEventInput>;

export interface CheckInCodeResponse {
  token: string;
  qrCodeUrl: string;
  expiresAt: string;
  refreshAt: string;
  venueLat: string | number | null;
  venueLng: string | number | null;
  geofenceRadius: number | null;
  geofenceEnabled: boolean;
}

export interface Minutes {
  id: string;
  eventId: string;
  body: string;
  summary: string | null;
  status: MinutesStatus;
  draftedById: string | null;
  draftedAt: string | null;
  publishedById: string | null;
  publishedAt: string | null;
  draftedBy?: { id: string; name: string; email: string } | null;
  publishedBy?: { id: string; name: string; email: string } | null;
  actionItems?: ActionItem[];
}

export interface ActionItem {
  id: string;
  minutesId: string;
  title: string;
  description: string | null;
  ownerId: string | null;
  ownerName: string | null;
  assignedById: string | null;
  dueDate: string;
  completedAt: string | null;
  status: ActionItemStatus;
  point: PointType;
  owner?: { id: string; name: string; email: string } | null;
  createdBy?: { id: string; name: string; email: string } | null;
  completedBy?: { id: string; name: string; email: string } | null;
}

export interface CreateActionItemInput {
  title: string;
  description?: string;
  ownerId?: string;
  ownerName?: string;
  dueDate: string;
  point?: PointType;
}

export interface AttendanceRecord {
  id: string;
  eventId: string;
  userId: string;
  signedName: string;
  checkInAt: string;
  checkInMethod: CheckInMethod;
  withinGeofence?: boolean | null;
  user?: { id: string; name: string; email: string };
}

export interface AddAttendeesInput {
  userIds?: string[];
  externals?: { name: string; email?: string }[];
}

export const CHECK_IN_METHOD_LABELS: Record<CheckInMethod, string> = {
  QR: 'QR scan',
  MANUAL: 'Manual',
  GEO: 'Geofence',
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  MEETING: 'Meeting',
  CONFERENCE: 'Conference',
  APPOINTMENT: 'Appointment',
  TRAINING: 'Training',
  WORKSHOP: 'Workshop',
  LAUNCH: 'Launch',
  OTHER: 'Other',
};

export const ACTION_ITEM_STATUS_LABELS: Record<ActionItemStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};
