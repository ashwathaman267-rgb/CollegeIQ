import * as React from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * CampusIQ identity: a crimson tile holding three ascending bars (data over a
 * campus baseline) beside the wordmark. Deliberately flat — no gradients.
 */
export function LogoMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn('grid shrink-0 place-items-center rounded-md bg-brand text-brand-fg', className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19h16" />
        <path d="M7 19v-5" />
        <path d="M12 19V8" />
        <path d="M17 19v-8" />
      </svg>
    </span>
  );
}

export function Logo({
  href = '/dashboard',
  institution,
  compact,
  tone = 'light',
  className,
}: {
  href?: string;
  institution?: { name?: string; shortName?: string; tagline?: string } | null;
  compact?: boolean;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const text = tone === 'dark' ? 'text-white' : 'text-ink';
  return (
    <Link href={href} className={cn('group flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50', className)} aria-label="CampusIQ home">
      <LogoMark size={compact ? 28 : 32} className="transition-transform duration-200 group-hover:-translate-y-px" />
      {compact ? null : (
        <span className="min-w-0">
          <span className={cn('block truncate text-[0.95rem] font-semibold leading-tight tracking-tight', text)}>
            Campus<span className="text-brand">IQ</span>
          </span>
          {institution?.tagline ? (
            <span className={cn('block truncate text-2xs leading-tight', tone === 'dark' ? 'text-[rgb(var(--sidebar-muted))]' : 'text-subtle')}>
              {institution.tagline}
            </span>
          ) : null}
        </span>
      )}
    </Link>
  );
}
