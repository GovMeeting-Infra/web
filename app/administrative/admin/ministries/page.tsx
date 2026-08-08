import { requireRole } from '@/lib/session';
import { MinistriesView } from './MinistriesView';

// Super-admin only, unlike the users page. A ministry admin may read ministries
// through the API but cannot create or change one, so there is nothing here for
// them — the API would refuse every action on the page.
export default async function AdminMinistriesPage() {
  await requireRole(['SUPER_ADMIN']);
  return <MinistriesView />;
}
