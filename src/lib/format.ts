import { round } from './utils';

/**
 * Consistent formatting helpers — the same rules are used everywhere so
 * percentages, dates and times never look different from screen to screen.
 */

export const DATE_FMT: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
};

export const DATE_SHORT_FMT: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };

export const TIME_FMT: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true };

export const DAY_FMT: Intl.DateTimeFormatOptions = { weekday: 'short' };

const toDate = (value: Date | string | number) =>
  value instanceof Date ? value : new Date(value);

export function formatDate(value?: Date | string | number | null, opts: Intl.DateTimeFormatOptions = DATE_FMT) {
  if (!value) return '—';
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', opts).format(d);
}

export function formatDateTime(value?: Date | string | number | null) {
  if (!value) return '—';
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${new Intl.DateTimeFormat('en-GB', DATE_FMT).format(d)}, ${formatTime(d)}`;
}

export function formatTime(value?: Date | string | null) {
  if (!value) return '—';
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', TIME_FMT).format(d);
}

/** "09:00" → "9:00 AM" */
export function formatClock(hhmm?: string | null) {
  if (!hhmm) return '—';
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** 84.62 → "84.6%" */
export function formatPercent(value?: number | null, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${round(value, digits).toFixed(digits)}%`;
}

/** +2.4 → "+2.4%" */
export function formatDelta(value?: number | null, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const r = round(value, digits);
  const sign = r > 0 ? '+' : '';
  return `${sign}${r.toFixed(digits)}%`;
}

export function formatNumber(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatGpa(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(2);
}

/** "MONDAY" → "Monday", "MON" for compact layouts */
export function formatDay(day: string, short = false) {
  const d = day.charAt(0) + day.slice(1).toLowerCase();
  return short ? d.slice(0, 3) : d;
}

/** Minutes → "1h 20m" */
export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** YYYY-MM-DD (UTC-safe for date-only columns) */
export function toDateInputValue(value?: Date | string | null) {
  if (!value) return '';
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Normalise any date-ish input to a UTC midnight Date (our date-only convention). */
export function toDayDate(value: Date | string) {
  const d = toDate(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function startOfDayUtc(value = new Date()) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function addDaysUtc(value: Date, days: number) {
  const d = new Date(value);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** ISO week day index with Monday = 1 … Sunday = 7 */
export function isoWeekday(value: Date) {
  const day = value.getUTCDay();
  return day === 0 ? 7 : day;
}

export const DAY_ORDER = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
