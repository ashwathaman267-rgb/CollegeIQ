'use client';

import * as React from 'react';
import { AlertTriangle, Ban, CheckCircle2, CircleDashed, Info, ShieldAlert } from 'lucide-react';

import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger' | 'info' | 'accent';

const TONE: Record<Tone, string> = {
  neutral: 'bg-line/60 text-muted border-line-strong',
  brand: 'bg-brand-soft text-brand border-brand/20',
  ok: 'bg-ok-soft text-ok-fg border-ok/25',
  warn: 'bg-warn-soft text-warn-fg border-warn/25',
  danger: 'bg-danger-soft text-danger-fg border-danger/25',
  info: 'bg-info-soft text-info-fg border-info/25',
  accent: 'bg-accent-soft text-accent border-accent/25',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  icon?: React.ReactNode;
}

/**
 * Status is never conveyed by colour alone: every badge pairs a tone with an
 * icon and a text label so it survives greyscale and colour-blind viewing.
 */
export function Badge({ className, tone = 'neutral', icon, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide whitespace-nowrap',
        TONE[tone],
        className,
      )}
      {...props}
    >
      {icon ? <span aria-hidden className="shrink-0 [&>svg]:h-3 [&>svg]:w-3">{icon}</span> : null}
      {children}
    </span>
  );
}

export type BandKey = 'SAFE' | 'AT_RISK' | 'FINE' | 'DEBARRED' | 'NO_DATA';

const BAND: Record<BandKey, { tone: Tone; label: string; icon: React.ReactNode }> = {
  SAFE: { tone: 'ok', label: 'Safe', icon: <CheckCircle2 /> },
  AT_RISK: { tone: 'warn', label: 'At risk', icon: <AlertTriangle /> },
  FINE: { tone: 'info', label: 'Fine applicable', icon: <ShieldAlert /> },
  DEBARRED: { tone: 'danger', label: 'Debarred', icon: <Ban /> },
  NO_DATA: { tone: 'neutral', label: 'No data', icon: <CircleDashed /> },
};

export function BandBadge({ band, label, className }: { band?: BandKey | string | null; label?: string; className?: string }) {
  const key = (band ?? 'NO_DATA') as BandKey;
  const meta = BAND[key] ?? BAND.NO_DATA;
  return (
    <Badge tone={meta.tone} icon={meta.icon} className={className}>
      {label ?? meta.label}
    </Badge>
  );
}

const STATUS_TONE: Record<string, { tone: Tone; label: string }> = {
  PRESENT: { tone: 'ok', label: 'Present' },
  ABSENT: { tone: 'danger', label: 'Absent' },
  LATE: { tone: 'warn', label: 'Late' },
  EXCUSED: { tone: 'info', label: 'Excused' },
  PASS: { tone: 'ok', label: 'Pass' },
  FAIL: { tone: 'danger', label: 'Fail' },
  PASS_WITH_ARREARS: { tone: 'warn', label: 'Pass with arrears' },
  PENDING: { tone: 'neutral', label: 'Pending' },
  OPEN: { tone: 'danger', label: 'Open' },
  CLEARED: { tone: 'ok', label: 'Cleared' },
  IN_PROGRESS: { tone: 'info', label: 'In progress' },
  CLOSED: { tone: 'neutral', label: 'Closed' },
  DRAFT: { tone: 'neutral', label: 'Draft' },
  PUBLISHED: { tone: 'ok', label: 'Published' },
  ARCHIVED: { tone: 'neutral', label: 'Archived' },
  COMPLETED: { tone: 'ok', label: 'Completed' },
  CANCELLED: { tone: 'neutral', label: 'Cancelled' },
  SCHEDULED: { tone: 'info', label: 'Scheduled' },
  ACTIVE: { tone: 'ok', label: 'Active' },
  INACTIVE: { tone: 'neutral', label: 'Inactive' },
  SUSPENDED: { tone: 'danger', label: 'Suspended' },
  GRADUATED: { tone: 'info', label: 'Graduated' },
  PROCESSING: { tone: 'info', label: 'Processing' },
  THEORY: { tone: 'info', label: 'Theory' },
  LABORATORY: { tone: 'accent', label: 'Lab' },
  ELECTIVE: { tone: 'neutral', label: 'Elective' },
  PROJECT: { tone: 'accent', label: 'Project' },
  SEMINAR: { tone: 'neutral', label: 'Seminar' },
  HIGH: { tone: 'danger', label: 'High priority' },
  MEDIUM: { tone: 'warn', label: 'Medium priority' },
  LOW: { tone: 'neutral', label: 'Low priority' },
  EXCELLENT: { tone: 'ok', label: 'Excellent alignment' },
  STRONG: { tone: 'ok', label: 'Strong alignment' },
  MODERATE: { tone: 'warn', label: 'Moderate alignment' },
  WEAK: { tone: 'warn', label: 'Weak alignment' },
  POOR: { tone: 'danger', label: 'Poor alignment' },
  FULL_TIME: { tone: 'brand', label: 'Full time' },
  PART_TIME: { tone: 'neutral', label: 'Part time' },
  INTERNSHIP: { tone: 'info', label: 'Internship' },
  CONTRACT: { tone: 'neutral', label: 'Contract' },
  REMOTE: { tone: 'accent', label: 'Remote' },
  ON_SITE: { tone: 'info', label: 'On site' },
  HYBRID: { tone: 'accent', label: 'Hybrid' },
};

export function StatusBadge({ status, className }: { status?: string | null; className?: string }) {
  if (!status) return null;
  const meta = STATUS_TONE[status] ?? { tone: 'neutral' as Tone, label: status.replace(/_/g, ' ').toLowerCase() };
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}

export function InfoBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Badge tone="info" icon={<Info />} className={className}>
      {children}
    </Badge>
  );
}
