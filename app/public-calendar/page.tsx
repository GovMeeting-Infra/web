import { redirect } from 'next/navigation';

/**
 * The public calendar lives at "/", but /public-calendar/day and
 * /public-calendar/event/[id] hang off this path — so anyone shortening a
 * shared link to /public-calendar hit a 404. Send them to the calendar.
 */
export default function PublicCalendarIndex() {
  redirect('/');
}
