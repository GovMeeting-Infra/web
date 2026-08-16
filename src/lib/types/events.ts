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

/** A decision, or something happening next. One line either way. */
export type MinutePointType = 'DECISION' | 'NEXT_STEP';

export interface MinutePoint {
  id: string;
  type: MinutePointType;
  text: string;
  order: number;
}

/** One row in the cross-event minutes list. */
export interface MinutesSummary {
  id: string;
  status: MinutesStatus;
  /** The first couple of decisions, standing in for the old summary line. */
  points: { id: string; text: string }[];
  draftedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  event: { id: string; title: string; startAt: string; ministryId: string };
  draftedBy: { id: string; name: string } | null;
  publishedBy: { id: string; name: string } | null;
  _count: { actionItems: number; points: number };
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
  ministry: { name: string } | null;
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
  _count: { attendees: number; attendances: number };
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
  /** Null means no invitation email has ever reached this person. */
  lastInvitedAt: string | null;
  createdAt: string;
  user?: { id: string; name: string; email: string } | null;
}

/** What POST /events/:id/attendees/:attendeeId/invite answers with. */
export interface ResendInviteResult {
  attendeeId: string;
  email: string;
  emailSent: boolean;
  emailError: string | null;
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
  organizer: { id: string; name: string; email: string } | null;
  coOrganizers: EventCoOrganizer[];
  attendees: EventAttendee[];
  minutes: { id: string; status: MinutesStatus } | null;
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
 * generated the code.
 *
 * Every code that exists is now fenced: generating one requires a fix good
 * enough to anchor from, so `enabled` false only describes an event that has no
 * code yet. It is no longer possible to mint a code that lets people check in
 * from anywhere.
 */
export interface CheckInGeofence {
  enabled: boolean;
  radiusMeters: number;
  anchorLat: number | null;
  anchorLng: number | null;
  anchorAccuracy: number | null;
  anchorSetAt: string | null;
  /** Always true. Kept so a refusal to generate can still be explained. */
  required?: boolean;
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
  /** Decisions and next steps together, ordered within each kind. */
  points: MinutePoint[];
  status: MinutesStatus;
  draftedById: string | null;
  draftedAt: string | null;
  publishedById: string | null;
  publishedAt: string | null;
  draftedBy?: { id: string; name: string; email: string } | null;
  publishedBy?: { id: string; name: string; email: string } | null;
  actionItems?: ActionItem[];
}

export interface ActionItemAssistant {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string };
}

export interface ActionItem {
  id: string;
  minutesId: string;
  title: string;
  description: string | null;
  ownerId: string | null;
  ownerName: string | null;
  /** Set when the owner has no account — the only way to reach them. */
  ownerEmail: string | null;
  assignedById: string | null;
  dueDate: string;
  completedAt: string | null;
  status: ActionItemStatus;
  point: PointType;
  /** What has been done, and a link to it. */
  progressNotes: string | null;
  progressLink: string | null;
  priority?: string;
  /**
   * Who else is working on this. They may report progress and move the
   * status; the owner stays the one person answerable for it.
   */
  assistants?: ActionItemAssistant[];
  owner?: { id: string; name: string; email: string } | null;
  /**
   * Who raised it. Named assignedBy to match what the API actually returns —
   * this was `createdBy`, which is never present, so "Assigned by" rendered as
   * a dash and the creator-can-edit rule never fired.
   */
  assignedBy?: { id: string; name: string; email: string } | null;
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
  ACTION_POINT: 'border-stat-violet-border bg-stat-violet-bg text-stat-violet-fg',
  AGREED: 'border-[#bfe4ee] bg-[#e8f7fb] text-[#0e6f85]',
  DECISION: 'border-stat-blue-border bg-stat-blue-bg text-primary',
};

export interface CreateActionItemInput {
  /** Assign to someone with no account; resolves to one when the email matches. */
  ownerEmail?: string;
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
  /**
   * Collected from a guest checking themselves in. Null for staff, whose
   * account carries a job title and ministry, and for a walk-in an organizer
   * recorded at the desk.
   */
  guestTitle?: string | null;
  guestOrganisation?: string | null;
  guestPhone?: string | null;
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
  /** Metres. Only present when the browser gave a position. */
  gpsAccuracy?: number | null;
  mockLocationFlag?: boolean;
  user?: {
    id: string;
    name: string;
    email: string;
    /** A staff member's title and ministry stand in for the guest fields. */
    jobTitle?: string | null;
    ministry?: { name: string } | null;
  };
}

/** Which of the attendees page's five lists an export covers. */
export type AttendanceExportSet =
  | 'checked-in'
  | 'invited'
  | 'confirmed'
  | 'declined'
  | 'awaiting';

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

/**
 * Status colour, in one place.
 *
 * There were two maps before this — one on the board and one on the table —
 * and they disagreed: the same In Progress item was amber in a column header
 * and blue in a row. Colour that changes depending on where you are looking
 * teaches nothing, so it lives here now, keyed by the enum so a new status
 * cannot be added without one.
 *
 * Red, amber and green carry the three columns, and are the same tints the
 * attendee and event pills already use. The two states without a column of
 * their own get hues from outside that progression, because they are outside
 * it: blocked is not a stage between started and finished, it is an exception,
 * and cancelled is closed without being done.
 *
 * Blocked is indigo rather than the obvious purple: every card already carries
 * a purple "Action Point" badge, and two purples on one card would say less
 * than one does.
 */
/**
 * Red, amber, green across the three columns of the board — the traffic-light
 * reading people already have for work that has not started, is moving, and is
 * finished.
 *
 * Overdue also uses red, on the due-date line. Where both apply the card says
 * "overdue" in words next to a warning icon, so the two are still separable.
 */
export const ACTION_ITEM_STATUS_STYLES: Record<ActionItemStatus, string> = {
  TODO: 'bg-destructive/10 text-destructive',
  IN_PROGRESS: 'bg-stat-gold-bg text-stat-gold-fg',
  COMPLETED: 'bg-stat-green-bg text-success',
  BLOCKED: 'bg-[#eef2ff] text-[#3730a3]',
  CANCELLED: 'bg-muted text-muted-foreground',
};

/** The same five as solid fills, for dots and bar segments. */
export const ACTION_ITEM_STATUS_DOT: Record<ActionItemStatus, string> = {
  TODO: 'bg-destructive',
  IN_PROGRESS: 'bg-accent',
  COMPLETED: 'bg-success',
  BLOCKED: 'bg-[#3730a3]',
  CANCELLED: 'bg-muted-foreground',
};

export type ActionItemPriority = 'low' | 'medium' | 'high';

export const ACTION_ITEM_PRIORITY_LABELS: Record<ActionItemPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};
