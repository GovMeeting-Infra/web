import { DashboardView } from './DashboardView';

/**
 * One dashboard, read two ways.
 *
 * For a meeting participant it answers "what do I have to do": what is on
 * today, my action items, meetings I organise. A platform admin has none of
 * those, so the same page answers "what is happening" instead — everything
 * scheduled across every ministry, and the aggregate figures. The personal
 * panels are not shown to them rather than shown empty, and none of it is
 * editable: the API admits that role to reading events and to the analytics
 * totals, and to nothing else here.
 */
export default function DashboardPage() {
  return <DashboardView />;
}
