'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
  label?: string;
}

function pageWindow(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | 'gap')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) pages.push('gap');
  for (let i = start; i <= end; i += 1) pages.push(i);
  if (end < totalPages - 1) pages.push('gap');
  pages.push(totalPages);
  return pages;
}

/** Page controls with an honest “showing X–Y of Z” summary. */
export function Pagination({ page, pageSize, total, totalPages, onChange, className, label = 'records' }: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pages = pageWindow(page, Math.max(1, totalPages));

  const arrow =
    'grid h-8 w-8 place-items-center rounded-md border border-line bg-surface text-muted transition-colors hover:border-line-strong hover:text-ink disabled:pointer-events-none disabled:opacity-40';

  return (
    <nav className={cn('flex flex-wrap items-center justify-between gap-3', className)} aria-label="Pagination">
      <p className="text-xs text-muted">
        Showing <span className="tnum font-semibold text-ink">{from}</span>–<span className="tnum font-semibold text-ink">{to}</span> of{' '}
        <span className="tnum font-semibold text-ink">{total}</span> {label}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className={arrow} onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="hidden items-center gap-1 sm:flex">
          {pages.map((entry, i) =>
            entry === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-subtle" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => onChange(entry)}
                aria-current={entry === page ? 'page' : undefined}
                className={cn(
                  'tnum h-8 min-w-8 rounded-md border px-2 text-[0.8125rem] font-medium transition-colors',
                  entry === page
                    ? 'border-brand bg-brand text-brand-fg'
                    : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink',
                )}
              >
                {entry}
              </button>
            ),
          )}
        </div>
        <span className="tnum px-2 text-xs text-muted sm:hidden">
          {page} / {Math.max(1, totalPages)}
        </span>
        <button
          type="button"
          className={arrow}
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}
