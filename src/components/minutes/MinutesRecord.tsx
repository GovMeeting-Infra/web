import { CheckCircle2, ArrowRight, ClipboardList } from 'lucide-react';
import {
  ACTION_ITEM_STATUS_LABELS,
  type ActionItem,
  type MinutePoint,
} from '@/lib/types/events';

/** The lines of one kind, in the order they were recorded. */
export function pointsOfType(
  points: MinutePoint[] | undefined,
  type: MinutePoint['type'],
): MinutePoint[] {
  return (points ?? []).filter((p) => p.type === type);
}

function Section({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {title}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {count}
        </span>
      </h3>
      {children}
    </section>
  );
}

/**
 * A minutes record, read-only.
 *
 * Three lists and nothing else — what was settled, who is doing what, and what
 * happens next. Sections with nothing in them are left out rather than shown
 * empty: a heading over a blank space reads as something missing, when in fact
 * plenty of meetings decide nothing and only agree who does what.
 */
export function MinutesRecord({
  points,
  actionItems,
}: {
  points: MinutePoint[] | undefined;
  actionItems: ActionItem[] | undefined;
}) {
  const decisions = pointsOfType(points, 'DECISION');
  const nextSteps = pointsOfType(points, 'NEXT_STEP');
  const items = actionItems ?? [];

  if (!decisions.length && !nextSteps.length && !items.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing has been recorded for this meeting.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {decisions.length > 0 && (
        <Section
          title="Decisions"
          count={decisions.length}
          icon={<CheckCircle2 className="h-4 w-4 text-ring" />}
        >
          <ul className="mt-2 space-y-1.5">
            {decisions.map((d) => (
              <li
                key={d.id}
                className="flex gap-2 text-sm leading-relaxed text-foreground"
              >
                <span aria-hidden className="text-muted-foreground">
                  •
                </span>
                <span className="break-words">{d.text}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {items.length > 0 && (
        <Section
          title="Action items"
          count={items.length}
          icon={<ClipboardList className="h-4 w-4 text-primary" />}
        >
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
            {items.map((item) => (
              <li key={item.id} className="px-3 py-2">
                <p className="text-sm font-medium text-foreground">
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.ownerName ?? item.owner?.name ?? 'Unassigned'}
                  {' · due '}
                  {new Date(item.dueDate).toLocaleDateString(undefined, {
                    dateStyle: 'medium',
                  })}
                  {' · '}
                  {ACTION_ITEM_STATUS_LABELS[item.status] ?? item.status}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {nextSteps.length > 0 && (
        <Section
          title="Next steps"
          count={nextSteps.length}
          icon={<ArrowRight className="h-4 w-4 text-muted-foreground" />}
        >
          <ul className="mt-2 space-y-1.5">
            {nextSteps.map((s) => (
              <li
                key={s.id}
                className="flex gap-2 text-sm leading-relaxed text-foreground"
              >
                <span aria-hidden className="text-muted-foreground">
                  •
                </span>
                <span className="break-words">{s.text}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
