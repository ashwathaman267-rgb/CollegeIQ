'use client';

import * as React from 'react';
import { AlertTriangle, Ban, CheckCircle2, Info, ShieldQuestion, X } from 'lucide-react';

import { cn } from '@/lib/utils';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'brand' | 'neutral';

const TONE: Record<Tone, { wrap: string; icon: React.ReactNode }> = {
  info: { wrap: 'border-info/30 bg-info-soft text-info-fg', icon: <Info className="h-4 w-4" /> },
  success: { wrap: 'border-ok/30 bg-ok-soft text-ok-fg', icon: <CheckCircle2 className="h-4 w-4" /> },
  warning: { wrap: 'border-warn/30 bg-warn-soft text-warn-fg', icon: <AlertTriangle className="h-4 w-4" /> },
  danger: { wrap: 'border-danger/30 bg-danger-soft text-danger-fg', icon: <Ban className="h-4 w-4" /> },
  brand: { wrap: 'border-brand/25 bg-brand-soft text-brand', icon: <ShieldQuestion className="h-4 w-4" /> },
  neutral: { wrap: 'border-line bg-raised text-muted', icon: <Info className="h-4 w-4" /> },
};

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: Tone;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  onDismiss?: () => void;
  action?: React.ReactNode;
}

export function Alert({ tone = 'info', title, icon, onDismiss, action, className, children, ...props }: AlertProps) {
  const meta = TONE[tone];
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-3.5 py-3 text-[0.8125rem] leading-relaxed', meta.wrap, className)} role={tone === 'danger' ? 'alert' : 'status'} {...props}>
      <span className="mt-0.5 shrink-0" aria-hidden>
        {icon ?? meta.icon}
      </span>
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5', 'opacity-90')}>{children}</div> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="-mr-1 -mt-1 grid h-6 w-6 shrink-0 place-items-center rounded opacity-70 transition-opacity hover:opacity-100"
          aria-label="Dismiss message"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * The disclaimer under every AI match score: alignment with the job
 * description, never a hiring prediction.
 */
export function AlignmentNotice({ className }: { className?: string }) {
  return (
    <Alert tone="brand" className={className} title="What this score means">
      The score measures how closely the resume matches this specific job description — skills, evidence, experience and keywords.
      It is not a prediction of hiring outcome, interview calls or job guarantees.
    </Alert>
  );
}
