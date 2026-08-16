'use client';

import { useRef } from 'react';
import { Plus, X, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * One editable list of single-line entries.
 *
 * Single-line inputs rather than a textarea, deliberately: the shape of the
 * control is what keeps a decision to a decision. Given somewhere to write a
 * paragraph, people write one, which is what this replaced.
 *
 * Reordering is two small buttons rather than drag-and-drop — these lists run
 * to a handful of lines, and dragging on a phone to move item two above item
 * one is more machinery than the job deserves.
 *
 * Enter moves to the next line. Adding a line used to mean leaving the keyboard
 * for the Add button and coming back, which on five decisions was around forty
 * keystrokes of navigation or nine trips to the pointer — on the one action
 * this page exists to repeat.
 */
export function PointList({
  label,
  singular,
  hint,
  placeholder,
  addLabel,
  icon,
  values,
  onChange,
  disabled,
}: {
  label: string;
  /** For per-row labels: "Decision 3" reads better than "Decisions 3". */
  singular: string;
  hint: string;
  placeholder: string;
  addLabel: string;
  icon: React.ReactNode;
  values: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const setAt = (index: number, text: string) =>
    onChange(values.map((v, i) => (i === index ? text : v)));

  const removeAt = (index: number) =>
    onChange(values.filter((_, i) => i !== index));

  const move = (index: number, by: number) => {
    const target = index + by;
    if (target < 0 || target >= values.length) return;
    const next = [...values];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
    // Follow the line that moved, so a second press keeps moving the same one
    // rather than whatever has landed under the cursor.
    requestAnimationFrame(() => inputs.current[target]?.focus());
  };

  const insertAfter = (index: number) => {
    const next = [...values];
    next.splice(index + 1, 0, '');
    onChange(next);
    requestAnimationFrame(() => inputs.current[index + 1]?.focus());
  };

  const addAtEnd = () => {
    onChange([...values, '']);
    requestAnimationFrame(() => inputs.current[values.length]?.focus());
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Only from a line with something on it — Enter on a blank line would
      // just stack empty rows.
      if (values[index]?.trim()) insertAfter(index);
      return;
    }

    // Backspace on an empty line removes it and steps back, the way a list in
    // any editor behaves.
    if (
      e.key === 'Backspace' &&
      !values[index] &&
      values.length > 1 &&
      index > 0
    ) {
      e.preventDefault();
      removeAt(index);
      requestAnimationFrame(() => inputs.current[index - 1]?.focus());
    }
  };

  // Always one row to type into, so the section never reads as unavailable.
  const rows = values.length ? values : [''];

  return (
    <div className="space-y-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          {icon}
          {label}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>

      <ul className="space-y-2">
        {rows.map((value, index) => (
          // Index keys on a reorderable list are usually a bug. Here every row
          // is a fully controlled input whose value comes from `values`, and
          // reordering swaps the values rather than the identities, so React
          // re-renders the same inputs with new text — which is exactly what
          // the focus handling above depends on.
          <li key={index} className="flex items-center gap-1.5">
            <input
              ref={(el) => {
                inputs.current[index] = el;
              }}
              type="text"
              value={value}
              onChange={(e) => {
                // The placeholder row only becomes real once it is typed into.
                if (!values.length) onChange([e.target.value]);
                else setAt(index, e.target.value);
              }}
              onKeyDown={(e) => handleKeyDown(e, index)}
              disabled={disabled}
              placeholder={placeholder}
              maxLength={300}
              aria-label={`${singular} ${index + 1}`}
              className="min-w-0 flex-1 rounded-xl border border-border bg-input px-3 py-2 text-sm focus:border-primary disabled:opacity-50"
            />
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={disabled || index === 0}
                aria-label={`Move ${singular} ${index + 1} up`}
                className="rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={disabled || index >= values.length - 1}
                aria-label={`Move ${singular} ${index + 1} down`}
                className="rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => removeAt(index)}
                disabled={disabled || !values.length}
                aria-label={`Remove ${singular} ${index + 1}`}
                className="rounded-lg p-2.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addAtEnd}
          disabled={disabled}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {addLabel}
        </button>
        <p className="text-xs text-muted-foreground">
          Or press Enter for the next line.
        </p>
      </div>
    </div>
  );
}
