'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { TrendingDown, TrendingUp } from 'lucide-react';

import { cn, clamp } from '@/lib/utils';

type Tone = 'brand' | 'ok' | 'warn' | 'danger' | 'info' | 'accent' | 'neutral';

const FILL: Record<Tone, string> = {
  brand: 'bg-brand',
  ok: 'bg-ok',
  warn: 'bg-warn',
  danger: 'bg-danger',
  info: 'bg-info',
  accent: 'bg-accent',
  neutral: 'bg-line-strong',
};

export function toneFor(value: number, thresholds: { safe: number; fine: number; debar: number }): Tone {
  if (value >= thresholds.safe) return 'ok';
  if (value >= thresholds.fine) return 'warn';
  if (value >= thresholds.debar) return 'info';
  return 'danger';
}

export interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  label?: string;
  className?: string;
  threshold?: number;
}

/** Accessible progress bar — the numeric value is always available as text too. */
export function ProgressBar({
  value,
  max = 100,
  tone = 'brand',
  size = 'md',
  showValue = false,
  label,
  className,
  threshold,
}: ProgressBarProps) {
  const pct = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
  const height = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' }[size];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <ProgressPrimitive.Root
        value={pct}
        max={100}
        aria-label={label ?? 'Progress'}
        className={cn('relative w-full overflow-hidden rounded-full bg-line/70', height)}
      >
        <ProgressPrimitive.Indicator
          className={cn('h-full origin-left rounded-full transition-[width] duration-500 ease-spring', FILL[tone])}
          style={{ width: `${pct}%` }}
        />
        {threshold !== undefined ? (
          <span
            className="absolute inset-y-0 w-px bg-ink/45"
            style={{ left: `${clamp(threshold, 0, 100)}%` }}
            aria-hidden
          />
        ) : null}
      </ProgressPrimitive.Root>
      {showValue ? <span className="tnum w-11 shrink-0 text-right text-xs font-semibold text-ink">{pct.toFixed(0)}%</span> : null}
    </div>
  );
}

/** Labelled percentage row — the building block of subject-wise attendance. */
export function MetricRow({
  label,
  sublabel,
  value,
  max = 100,
  tone,
  suffix = '%',
  trailing,
  threshold,
  href,
}: {
  label: React.ReactNode;
  sublabel?: React.ReactNode;
  value: number;
  max?: number;
  tone?: Tone;
  suffix?: string;
  trailing?: React.ReactNode;
  threshold?: number;
  href?: string;
}) {
  const pct = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;

  const inner = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-ink">{label}</p>
        <p className="tnum shrink-0 text-sm font-semibold text-ink">
          {value.toFixed(max > 100 ? 0 : 1)}
          {suffix}
        </p>
      </div>
      <div className="mt-1.5">
        <ProgressBar value={pct} tone={tone ?? 'brand'} size="sm" threshold={threshold} label={typeof label === 'string' ? label : undefined} />
      </div>
      {sublabel || trailing ? (
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
          <span className="min-w-0 truncate">{sublabel}</span>
          {trailing}
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <a href={href} className="stack-item block rounded-r-md py-2.5 pr-2 transition-colors hover:bg-raised/60">
        {inner}
      </a>
    );
  }
  return <div className="stack-item block py-2.5 pr-2">{inner}</div>;
}

/** Compact donut used for match scores and pass rates. */
export function ScoreDial({
  value,
  label,
  tone = 'brand',
  size = 132,
  hint,
}: {
  value: number;
  label?: string;
  tone?: Tone;
  size?: number;
  hint?: string;
}) {
  const pct = clamp(value, 0, 100);
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = `rgb(var(--${tone === 'brand' ? 'brand' : tone}))`;

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${label ?? 'Score'}: ${pct.toFixed(0)} percent`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgb(var(--line))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset .7s cubic-bezier(.22,1,.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="tnum text-2xl font-semibold leading-none text-ink">{pct.toFixed(0)}%</span>
        {label ? <span className="mt-1 text-2xs uppercase tracking-[0.1em] text-subtle">{label}</span> : null}
        {hint ? <span className="mt-0.5 max-w-[6rem] text-2xs text-muted">{hint}</span> : null}
      </div>
    </div>
  );
}

export function DeltaTag({ delta, suffix = '%', className }: { delta?: number | null; suffix?: string; className?: string }) {
  if (delta === undefined || delta === null || Number.isNaN(delta)) return null;
  const positive = delta > 0;
  const flat = delta === 0;
  return (
    <span
      className={cn(
        'tnum inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-semibold',
        flat ? 'bg-line/60 text-muted' : positive ? 'bg-ok-soft text-ok-fg' : 'bg-danger-soft text-danger-fg',
        className,
      )}
    >
      {flat ? null : positive ? <TrendingUp className="h-3 w-3" aria-hidden /> : <TrendingDown className="h-3 w-3" aria-hidden />}
      {flat ? 'No change' : `${positive ? '+' : '−'}${Math.abs(delta).toFixed(1)}${suffix}`}
    </span>
  );
}
