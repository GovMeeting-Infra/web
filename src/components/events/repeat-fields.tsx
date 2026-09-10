'use client';

import { FREQUENCY_LABELS, type EndType, type Frequency } from '@/lib/types/events';
import {
  usesInterval,
  type RecurrenceValue,
} from '@/lib/utils/recurrence';

const FREQUENCIES = Object.keys(FREQUENCY_LABELS) as Frequency[];

const field =
  'mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none';
const smallLabel = 'text-xs font-medium text-foreground/80';

/**
 * How an activity repeats.
 *
 * Lived inline in the scheduling form and nowhere else, which is why an
 * activity's repeat could be set once and never changed again — the edit form
 * had nothing to reuse and nobody was going to paste seventy lines of controls
 * into it. Shared now, and controlled, so both forms hold their own state.
 *
 * `idPrefix` is not decoration: the ids used to be bare, so rendering this
 * twice on a page — or alongside a form that already has a "frequency" field —
 * would break the association between every label and its control, which is
 * the whole of the accessible name for a screen reader.
 */
export function RepeatFields({
  value,
  onChange,
  idPrefix,
  disabled,
  startAt,
  existingSeries = false,
}: {
  value: RecurrenceValue;
  onChange: (next: RecurrenceValue) => void;
  idPrefix: string;
  disabled?: boolean;
  /** The activity's start, to check an end date against. */
  startAt?: string;
  /** Whether this activity already repeats, which changes what a count means. */
  existingSeries?: boolean;
}) {
  const set = (patch: Partial<RecurrenceValue>) =>
    onChange({ ...value, ...patch });

  const id = (name: string) => `${idPrefix}-${name}`;

  // An end date before the activity itself produced a series of exactly one
  // occurrence and said nothing about why.
  const untilTooEarly =
    value.endType === 'UNTIL' &&
    !!value.until &&
    !!startAt &&
    new Date(value.until) < new Date(startAt.slice(0, 10));

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <h2 className="text-sm font-medium text-foreground">Repeat</h2>

      <div className="mt-3 space-y-3">
        <div>
          <label className={smallLabel} htmlFor={id('frequency')}>
            Frequency
          </label>
          <select
            id={id('frequency')}
            value={value.frequency}
            disabled={disabled}
            onChange={(e) =>
              set({ frequency: e.target.value as Frequency | '' })
            }
            className={field}
          >
            <option value="">Does not repeat</option>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </div>

        {value.frequency && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Hidden for the two frequencies it means nothing to, rather
                  than offering a combination that has to be explained. */}
              {usesInterval(value.frequency) && (
                <div>
                  <label className={smallLabel} htmlFor={id('interval')}>
                    Interval
                  </label>
                  <input
                    id={id('interval')}
                    type="number"
                    min="1"
                    max="52"
                    value={value.interval}
                    disabled={disabled}
                    onChange={(e) => set({ interval: e.target.value })}
                    className={field}
                  />
                </div>
              )}

              <div>
                <label className={smallLabel} htmlFor={id('ends')}>
                  Ends
                </label>
                <select
                  id={id('ends')}
                  value={value.endType}
                  disabled={disabled}
                  onChange={(e) => set({ endType: e.target.value as EndType })}
                  className={field}
                >
                  <option value="COUNT">After a number of times</option>
                  <option value="UNTIL">On a date</option>
                  <option value="NEVER">Never</option>
                </select>
              </div>

              {value.endType === 'COUNT' && (
                <div>
                  <label className={smallLabel} htmlFor={id('occurrences')}>
                    Occurrences
                  </label>
                  <input
                    id={id('occurrences')}
                    type="number"
                    min="2"
                    max="200"
                    value={value.count}
                    disabled={disabled}
                    onChange={(e) => set({ count: e.target.value })}
                    className={field}
                  />
                </div>
              )}

              {value.endType === 'UNTIL' && (
                <div>
                  <label className={smallLabel} htmlFor={id('until')}>
                    Until
                  </label>
                  <input
                    id={id('until')}
                    type="date"
                    value={value.until}
                    disabled={disabled}
                    min={startAt ? startAt.slice(0, 10) : undefined}
                    onChange={(e) => set({ until: e.target.value })}
                    className={field}
                  />
                </div>
              )}
            </div>

            {/* Says what the number counts. A rebuild keeps the meetings that
                have already happened, so a series shortened to four when three
                were held adds one — which looks like a bug unless the total is
                understood to include them. */}
            {value.endType === 'COUNT' && existingSeries && (
              <p className="text-xs text-muted-foreground">
                The total for the whole series, counting occurrences already
                held — those are never changed.
              </p>
            )}

            {value.endType === 'NEVER' && (
              <p className="text-xs text-muted-foreground">
                Occurrences are created up to 200 at a time. Extend the series
                nearer the time to go on past that.
              </p>
            )}

            {untilTooEarly && (
              <p className="text-xs text-destructive">
                That date is before the activity starts, so nothing would
                repeat.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
