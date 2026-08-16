import type { EventType } from './types/events';

/**
 * Palette for calendar chips. Keys match the values the create form's category
 * combobox writes to colorCategory, so a categorised event picks its colour up
 * directly. Same brand hues used across the app.
 */
const CATEGORY_COLORS: Record<string, string> = {
  CONFERENCE: 'border-stat-blue-border bg-stat-blue-bg text-primary',
  MEETING: 'border-stat-green-border bg-stat-green-bg text-success',
  WORKSHOP: 'border-stat-blue-border bg-[#eef4ff] text-primary',
  TRAINING: 'border-stat-gold-border bg-stat-gold-bg text-stat-gold-fg',
  LAUNCH: 'border-[#f8b4b4] bg-[#fde8e8] text-[#9b1c1c]',
  APPOINTMENT: 'border-stat-violet-border bg-stat-violet-bg text-stat-violet-fg',
  OTHER: 'border-slate-200 bg-slate-50 text-slate-700',
};

const FALLBACK = 'border-slate-200 bg-slate-50 text-slate-700';

/**
 * PAGES.md asks for colour by event type. colorCategory is free text and often
 * unset, so fall back to the event's type — every event then gets a colour
 * rather than a wall of grey.
 */
export function eventColor(
  colorCategory?: string | null,
  type?: EventType | null,
): string {
  const key = (colorCategory ?? type ?? '').toUpperCase();
  return CATEGORY_COLORS[key] ?? FALLBACK;
}

export function eventCategoryLabel(
  colorCategory?: string | null,
  type?: EventType | null,
): string {
  const raw = colorCategory ?? type;
  if (!raw) return 'Uncategorised';
  return raw.charAt(0) + raw.slice(1).toLowerCase();
}

/** YYYY-MM-DD in local time, for the ?d= day-view parameter. */
export function toDayParam(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
