import { headers } from 'next/headers';

import { tooManyRequests } from '@/server/api/errors';

/**
 * In-memory sliding-window rate limiter.
 *
 * A single Next.js server process is the deployment unit for CampusIQ, so a
 * Map is enough; if the app is scaled horizontally, swap the store for Redis
 * behind the same interface (nothing else changes).
 */

export interface RateLimitOptions {
  /** Maximum number of requests inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Bucket name — different buckets never share counters. */
  bucket?: string;
  /** Key the counter by IP (default) or by user id when signed in. */
  key?: string;
}

interface Bucket {
  hits: number[];
}

const STORE = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 5000;

export function clientIp() {
  const h = headers();
  const forwarded = h.get('x-forwarded-for');
  return (forwarded ? forwarded.split(',')[0] : undefined)?.trim() || h.get('x-real-ip') || 'local';
}

function prune(now: number) {
  if (STORE.size <= MAX_TRACKED_KEYS) return;
  for (const [key, bucket] of STORE) {
    if (bucket.hits.length === 0 || bucket.hits[bucket.hits.length - 1] < now - 10 * 60 * 1000) {
      STORE.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}

export function rateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const key = `${options.bucket ?? 'default'}:${options.key ?? clientIp()}`;
  const bucket = STORE.get(key) ?? { hits: [] };

  const windowStart = now - options.windowMs;
  bucket.hits = bucket.hits.filter((t) => t > windowStart);

  if (bucket.hits.length >= options.limit) {
    STORE.set(key, bucket);
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.hits[0] + options.windowMs - now) / 1000));
    return { allowed: false, limit: options.limit, remaining: 0, retryAfterSeconds, resetAt: bucket.hits[0] + options.windowMs };
  }

  bucket.hits.push(now);
  STORE.set(key, bucket);
  prune(now);

  return {
    allowed: true,
    limit: options.limit,
    remaining: Math.max(0, options.limit - bucket.hits.length),
    retryAfterSeconds: 0,
    resetAt: now + options.windowMs,
  };
}

/** Throws a 429 AppError when the caller is over the limit. */
export function enforceRateLimit(options: RateLimitOptions) {
  const result = rateLimit(options);
  if (!result.allowed) {
    throw tooManyRequests(
      `Too many requests. Please wait ${result.retryAfterSeconds} second${result.retryAfterSeconds === 1 ? '' : 's'} and try again.`,
    );
  }
  return result;
}

export const RATE_LIMITS = {
  auth: { limit: 10, windowMs: 60 * 1000, bucket: 'auth' },
  passwordReset: { limit: 3, windowMs: 15 * 60 * 1000, bucket: 'reset' },
  upload: { limit: 12, windowMs: 60 * 1000, bucket: 'upload' },
  ai: { limit: 20, windowMs: 60 * 1000, bucket: 'ai' },
  write: { limit: 120, windowMs: 60 * 1000, bucket: 'write' },
  read: { limit: 600, windowMs: 60 * 1000, bucket: 'read' },
  search: { limit: 60, windowMs: 60 * 1000, bucket: 'search' },
} as const satisfies Record<string, RateLimitOptions>;

export function resetRateLimits() {
  STORE.clear();
}
