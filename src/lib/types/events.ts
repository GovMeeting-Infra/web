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

/** One row in the cross-event minutes list. */
export interface MinutesSummary {
  id: string;
  status: MinutesStatus;
  summary: string | null;
  draftedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  event: { id: string; title: string; startAt: string; ministryId: string };
  draftedBy: { id: string; name: string } | null;
  publishedBy: { id: string; name: string } | null;
  _count: { actionItems: number };
}

export interface MinutesListResponse {
  data: MinutesSummary[];
  total: number;
}
export type PointType = 'ACTION_POINT' | 'AGREED' | 'DECISION';
export type ActionItemStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'CANCELLED';
export type AttendeeStatus = 'INVITED' | 'CONFIRMED' | 'DECLINED' | 'NO_RESPONSE';
export type RSVPStatus = 'CONFIRMED' | 'DECLINED';

/**
 * INVITED and NO_RESPONSE both mean "asked, hasn't answered" — the first is set
 * on invitation, the second when a reminder lapses — so they read the same.
 */
export const ATTENDEE_STATUS_LABELS: Record<AttendeeStatus, string> = {
  INVITED: 'Awaiting response',
  NO_RESPONSE: 'Awaiting response',
  CONFIRMED: 'Confirmed',
  DECLINED: 'Declined',
};

/** Lean shape returned by the unauthenticated public calendar endpoints. */
export interface PublicEventListItem {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  colorCategory: string | null;
  type: EventType | null;
  venueName: string | null;
  bannerImage: string | null;
}

export interface PublicEventDetail extends PublicEventListItem {
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  externalUrl: string | null;
  ministry: { name: string } | null;
}

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
  allowGuestCheckIn: boolean;
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
  allowGuestCheckIn?: boolean;
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

/**
 * The check-in area, anchored to wherever the organizer stood when they
 * generated the code. `enabled` false means no usable location was available,
 * so attendees can check in from anywhere and are recorded as unverified.
 */
export interface CheckInGeofence {
  enabled: boolean;
  radiusMeters: number;
  anchorLat: number | null;
  anchorLng: number | null;
  anchorAccuracy: number | null;
  anchorSetAt: string | null;
}

export interface CheckInCodeResponse {
  /** null until an organizer explicitly generates one. */
  token: string | null;
  qrCodeUrl: string | null;
  expiresAt: string | null;
  refreshAt: string | null;
  geofence: CheckInGeofence;
  allowGuestCheckIn: boolean;
  eventStatus: EventStatus;
  endAt: string;
}

/** Why a scanned token can or cannot be used right now. */
export type CheckInStatus =
  | 'INVALID'
  | 'EXPIRED'
  | 'UNAVAILABLE'
  | 'ENDED'
  | 'OPEN';

export interface CheckInContext {
  status: CheckInStatus;
  event: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    venueName: string | null;
    allowGuestCheckIn: boolean;
  } | null;
  /** True when a check-in area exists, so location is mandatory. */
  geofenceRequired: boolean;
}

export interface CheckInResult {
  id: string;
  eventId: string;
  eventTitle: string;
  signedName: string;
  checkInAt: string;
  checkInMethod: CheckInMethod;
  withinGeofence: boolean | null;
  isWalkIn: boolean;
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

/** Action item as returned by the cross-event board endpoint. */
export interface BoardActionItem extends ActionItem {
  minutes: {
    id: string;
    event: { id: string; title: string; ministryId: string };
  };
  createdAt: string;
  updatedAt: string;
}

/** The three columns the board shows; the enum has two further states. */
export const BOARD_COLUMNS = [
  { status: 'TODO' as const, label: 'To Do' },
  { status: 'IN_PROGRESS' as const, label: 'In Progress' },
  { status: 'COMPLETED' as const, label: 'Done' },
];

/**
 * BLOCKED and CANCELLED have no column of their own, so they ride along with
 * the nearest one rather than vanishing from the board.
 */
export function boardColumnFor(status: ActionItemStatus): ActionItemStatus {
  if (status === 'BLOCKED') return 'TODO';
  if (status === 'CANCELLED') return 'COMPLETED';
  return status;
}

export function isActionItemOverdue(item: {
  dueDate: string;
  status: ActionItemStatus;
}): boolean {
  if (item.status === 'COMPLETED' || item.status === 'CANCELLED') return false;
  return new Date(item.dueDate).getTime() < Date.now();
}

export const POINT_LABELS: Record<PointType, string> = {
  ACTION_POINT: 'Action Point',
  AGREED: 'Agreed',
  DECISION: 'Decision',
};

export const POINT_STYLES: Record<PointType, string> = {
  ACTION_POINT: 'border-[#d9cff2] bg-[#f3effd] text-[#4c1d95]',
  AGREED: 'border-[#bfe4ee] bg-[#e8f7fb] text-[#0e6f85]',
  DECISION: 'border-[#c9d9f2] bg-[#edf3fd] text-[#003580]',
};

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
  /** null for guests, who have no account. */
  userId: string | null;
  guestName?: string | null;
  guestEmail?: string | null;
  /** A guest with no matching invite for this event. */
  isWalkIn?: boolean;
  signedName: string;
  /**
   * Whether the attendee signed. False for a walk-in an organizer recorded at
   * the desk, where nobody was there to sign. The signature itself never leaves
   * the server on this endpoint — it is large and only needed per record.
   */
  hasSignature?: boolean;
  checkInAt: string;
  checkInMethod: CheckInMethod;
  /** null means no check-in area was set, not that the check failed. */
  withinGeofence?: boolean | null;
  mockLocationFlag?: boolean;
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
