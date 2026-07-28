import { requireRole, STAFF_ROLES } from '@/lib/session';
import { EventsList } from './EventsList';

// PAGES.md marks this route Staff+, so the gate runs server-side and redirects
// to /forbidden rather than rendering an empty list the API would refuse.
export default async function EventsPage() {
  await requireRole(STAFF_ROLES);

  return <EventsList />;
}
