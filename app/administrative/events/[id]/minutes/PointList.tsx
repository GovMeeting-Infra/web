'use client';

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
 */
export function PointList({
  label,
  hint,
  placeholder,
  addLabel,
  icon,
  values,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  placeholder: string;
  addLabel: string;
  icon: React.ReactNode;
  values: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
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
          <li key={index} className="flex items-center gap-1.5">
            <input
              type="text"
              value={value}
              onChange={(e) => {
                // The placeholder row only becomes real once it is typed into.
                if (!values.length) onChange([e.target.value]);
                else setAt(index, e.target.value);
              }}
              disabled={disabled}
              placeholder={placeholder}
              maxLength={300}
              aria-label={`${label} ${index + 1}`}
              className="min-w-0 flex-1 rounded-xl border border-border bg-input px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={disabled || index === 0}
                aria-label={`Move ${label} ${index + 1} up`}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={disabled || index >= values.length - 1}
                aria-label={`Move ${label} ${index + 1} down`}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => removeAt(index)}
                disabled={disabled || !values.length}
                aria-label={`Remove ${label} ${index + 1}`}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onChange([...values, ''])}
        disabled={disabled}
        className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        {addLabel}
      </button>
    </div>
  );
}
