export type BookingPurpose =
  | 'MEETING'
  | 'TRAINING'
  | 'CONFERENCE'
  | 'WORKSHOP'
  | 'INTERVIEW'
  | 'OTHER';

export type BookingStatus = 'CONFIRMED' | 'CANCELLED';

export interface Room {
  id: string;
  ministryId: string;
  name: string;
  location: string;
  capacity: number;
  amenities: string[];
  latitude: number | null;
  longitude: number | null;
  active: boolean;
  _count: { bookings: number; events: number };
  /** Confirmed bookings starting today; merged in by the rooms service. */
  bookingsToday: number;
}

export interface CreateRoomInput {
  name: string;
  location: string;
  capacity: number;
  amenities?: string[];
  /** Super-admins only; ignored for everyone else. */
  ministryId?: string;
}

export type UpdateRoomInput = Partial<Omit<CreateRoomInput, 'ministryId'>>;

export interface RoomBooking {
  id: string;
  roomId: string;
  userId: string;
  startTime: string;
  endTime: string;
  purpose: BookingPurpose;
  attendeeCount: number;
  notes: string | null;
  status: BookingStatus;
  bookedBy?: { id: string; name: string; email: string } | null;
}

export const BOOKING_PURPOSE_LABELS: Record<BookingPurpose, string> = {
  MEETING: 'Meeting',
  TRAINING: 'Training',
  CONFERENCE: 'Conference',
  WORKSHOP: 'Workshop',
  INTERVIEW: 'Interview',
  OTHER: 'Other',
};

/** A booking or an event occupying a room, normalised for availability. */
export interface Occupancy {
  id: string;
  kind: 'booking' | 'event';
  title: string;
  who: string | null;
  start: Date;
  end: Date;
}

export function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  // Half-open comparison: touching intervals do not conflict.
  return aStart < bEnd && bStart < aEnd;
}
