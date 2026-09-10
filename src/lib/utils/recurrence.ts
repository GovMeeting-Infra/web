import {
  FREQUENCY_LABELS,
  type EndType,
  type EventSeries,
  type Frequency,
} from '@/lib/types/events';

/**
 * A repeat rule as the forms hold it while it is being edited.
 *
 * Strings where the controls produce strings, so nothing has to be parsed on
 * every keystroke, and an empty frequency for "does not repeat" — which is a
 * real answer on the edit form, where it means stop repeating.
 */
export interface RecurrenceValue {
  frequency: Frequency | '';
  interval: string;
  endType: EndType;
  count: string;
  until: string;
}

export const NO_RECURRENCE: RecurrenceValue = {
  frequency: '',
  interval: '1',
  endType: 'COUNT',
  count: '4',
  until: '',
};

/** Seeds the form from what the activity currently repeats by. */
export function seriesToValue(
  series: EventSeries | null | undefined,
): RecurrenceValue {
  if (!series) return NO_RECURRENCE;
  return {
    frequency: series.frequency,
    interval: String(series.interval ?? 1),
    endType: series.endType,
    count: series.count != null ? String(series.count) : '4',
    // The input wants yyyy-mm-dd; the API sends a full timestamp.
    until: series.until ? series.until.slice(0, 10) : '',
  };
}

/** The body for PUT /events/:id/series, or null when it should not repeat. */
export function valueToPayload(v: RecurrenceValue): Record<
  string,
  unknown
> | null {
  if (!v.frequency) return null;
  return {
    frequency: v.frequency,
    interval: Number(v.interval) || 1,
    endType: v.endType,
    // Sent only for the ending that uses it. The server now rejects a COUNT
    // rule with no count rather than quietly running to its own ceiling, so a
    // stale value from the other branch must not travel.
    count: v.endType === 'COUNT' ? Number(v.count) || 2 : undefined,
    until:
      v.endType === 'UNTIL' && v.until
        ? new Date(v.until).toISOString()
        : undefined,
  };
}

/** Whether the rule was left exactly as it was found. */
export function sameRecurrence(a: RecurrenceValue, b: RecurrenceValue): boolean {
  if (a.frequency !== b.frequency) return false;
  // Nothing else matters once it does not repeat.
  if (!a.frequency) return true;
  if (Number(a.interval) !== Number(b.interval)) return false;
  if (a.endType !== b.endType) return false;
  if (a.endType === 'COUNT') return Number(a.count) === Number(b.count);
  if (a.endType === 'UNTIL') return a.until === b.until;
  return true;
}

/**
 * Interval is meaningless for these two.
 *
 * "Every weekday" advances one working day whatever the interval says, and
 * "every two weeks" is already an interval — the server multiplies it, so
 * "every 2 × every two weeks" quietly means monthly. Better not to offer the
 * combination than to explain it.
 */
export function usesInterval(frequency: Frequency | ''): boolean {
  return !!frequency && frequency !== 'WEEKDAYS' && frequency !== 'BIWEEKLY';
}

/** Human sentence for a rule, e.g. "Weekly · 4 occurrences". */
export function describeRecurrence(series: EventSeries): string {
  const every =
    series.interval > 1
      ? `Every ${series.interval} × ${FREQUENCY_LABELS[series.frequency].toLowerCase()}`
      : FREQUENCY_LABELS[series.frequency];

  if (series.endType === 'COUNT' && series.count) {
    return `${every} · ${series.count} occurrences`;
  }
  if (series.endType === 'UNTIL' && series.until) {
    return `${every} · until ${new Date(series.until).toLocaleDateString(undefined, { dateStyle: 'medium' })}`;
  }
  return `${every} · no end date`;
}
