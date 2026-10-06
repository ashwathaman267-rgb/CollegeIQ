'use client';

import * as React from 'react';
import { AlertTriangle, Inbox, RefreshCw, SearchX, ServerCrash, WifiOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ApiError } from '@/lib/api-client';
import { Button } from './button';

// ── Loading ─────────────────────────────────────────────────────────────

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2', className)}>
      <RefreshCw className="h-4 w-4 animate-spin text-brand" aria-hidden />
      {label ? <span className="text-sm text-muted">{label}</span> : null}
      <span className="sr-only">Loading</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line" aria-busy="true">
      <div className="flex gap-4 bg-raised px-4 py-2.5">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
      <span className="sr-only">Loading table…</span>
    </div>
  );
}

export function SkeletonTiles({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-line bg-surface p-4 shadow-card">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

// ── Empty ───────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

/** Shown whenever a list, table or chart has no rows — never a blank panel. */
export function EmptyState({ title, description, icon, action, secondaryAction, className, compact }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14', className)}>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-line/50 text-subtle [&>svg]:h-5 [&>svg]:w-5" aria-hidden>
        {icon ?? <Inbox />}
      </span>
      <div className="max-w-md space-y-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description ? <p className="text-[0.8125rem] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {action || secondaryAction ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}

export function NoSearchResults({ query, onReset }: { query: string; onReset?: () => void }) {
  return (
    <EmptyState
      icon={<SearchX />}
      title={`No matches for “${query}”`}
      description="Try a different spelling, or clear the filters to see everything."
      action={onReset ? <Button size="sm" onClick={onReset}>Clear filters</Button> : undefined}
      compact
    />
  );
}

// ── Error ───────────────────────────────────────────────────────────────

export function ErrorState({
  error,
  onRetry,
  title,
  className,
}: {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  const apiError = error instanceof ApiError ? error : null;
  const offline = apiError?.isNetworkError;
  const heading = title ?? (offline ? 'Cannot reach the server' : apiError?.isAuthError ? 'You do not have access' : 'Something went wrong');
  const detail = offline
    ? 'Your connection dropped or the CampusIQ API is unavailable. Nothing was saved.'
    : apiError?.message ?? 'An unexpected error occurred. Your data has not been changed.';

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)} role="alert">
      <span
        className={cn(
          'grid h-12 w-12 place-items-center rounded-full [&>svg]:h-5 [&>svg]:w-5',
          offline ? 'bg-warn-soft text-warn-fg' : 'bg-danger-soft text-danger-fg',
        )}
        aria-hidden
      >
        {offline ? <WifiOff /> : apiError?.isAuthError ? <AlertTriangle /> : <ServerCrash />}
      </span>
      <div className="max-w-md space-y-1">
        <p className="text-sm font-semibold text-ink">{heading}</p>
        <p className="text-[0.8125rem] leading-relaxed text-muted">{detail}</p>
        {apiError?.fieldErrors?.length ? (
          <ul className="mx-auto mt-2 max-w-sm space-y-1 text-left">
            {apiError.fieldErrors.slice(0, 4).map((f, i) => (
              <li key={i} className="rounded border border-danger/25 bg-danger-soft px-2 py-1 text-xs text-danger-fg">
                {f.field ? <span className="font-semibold">{f.field}: </span> : null}
                {f.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {onRetry ? (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Try again
        </Button>
      ) : null}
    </div>
  );
}
