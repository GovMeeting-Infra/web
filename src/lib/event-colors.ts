import type { EventType } from './types/events';

/**
 * Palette for calendar chips. Keys match the values the create form's category
 * combobox writes to colorCategory, so a categorised event picks its colour up
 * directly. Same brand hues used across the app.
 */
const CATEGORY_COLORS: Record<string, string> = {
  CONFERENCE: 'border-[#c9d9f2] bg-[#edf3fd] text-[#003580]',
  MEETING: 'border-[#cfe5d7] bg-[#edf8f1] text-[#007236]',
  WORKSHOP: 'border-[#c9d9f2] bg-[#eef4ff] text-[#003580]',
  TRAINING: 'border-[#fde8a6] bg-[#fff8e5] text-[#8d6400]',
  LAUNCH: 'border-[#f8b4b4] bg-[#fde8e8] text-[#9b1c1c]',
  APPOINTMENT: 'border-[#d9cff2] bg-[#f3effd] text-[#4c1d95]',
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
