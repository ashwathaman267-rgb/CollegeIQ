import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware className joiner. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export const round = (n: number, digits = 1) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

export const safeDivide = (a: number, b: number, fallback = 0) => (b === 0 ? fallback : a / b);

export const percent = (part: number, total: number) => round(safeDivide(part, total) * 100, 1);

export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export const average = (values: number[]) => (values.length ? round(sum(values) / values.length, 2) : 0);

export function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K) {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function initials(first?: string | null, last?: string | null) {
  const a = (first ?? '').trim().charAt(0);
  const b = (last ?? '').trim().charAt(0);
  return (a + b).toUpperCase() || '?';
}

export function fullName(first?: string | null, last?: string | null) {
  return [first, last].filter(Boolean).join(' ').trim() || 'Unnamed';
}

export function titleCase(input: string) {
  return input
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function truncate(input: string, max = 120) {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1).trimEnd()}…`;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deterministic 32-bit hash — used to keep demo data stable across reloads. */
export function hashString(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Seeded PRNG (mulberry32) so generated demo data is reproducible. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length) % items.length];
}

export function randomInt(random: () => number, min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${round(bytes / 1024, 0)} KB`;
  return `${round(bytes / (1024 * 1024), 1)} MB`;
}

export function relativeTime(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < min) return 'just now';
  if (abs < hour) return rtf.format(Math.round(-diff / min), 'minute');
  if (abs < day) return rtf.format(Math.round(-diff / hour), 'hour');
  if (abs < 30 * day) return rtf.format(Math.round(-diff / day), 'day');
  if (abs < 365 * day) return rtf.format(Math.round(-diff / (30 * day)), 'month');
  return rtf.format(Math.round(-diff / (365 * day)), 'year');
}

/** Build a query string, skipping null/undefined/empty values. */
export function toQueryString(params: Record<string, unknown>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const v of value) if (v !== undefined && v !== null) search.append(key, String(v));
    } else {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}
