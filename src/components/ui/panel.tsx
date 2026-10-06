import * as React from 'react';
import { cn } from '@/lib/utils';

export function Panel({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={cn('panel', className)} {...props}>
      {children}
    </section>
  );
}

export interface PanelHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}

export function PanelHeader({ title, subtitle, actions, icon, className, ...props }: PanelHeaderProps) {
  return (
    <header className={cn('panel-head', className)} {...props}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-soft text-brand [&>svg]:h-4 [&>svg]:w-4" aria-hidden>
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="panel-title truncate">{title}</h2>
          {subtitle ? <p className="panel-sub">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function PanelBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-4 sm:p-5', className)} {...props}>
      {children}
    </div>
  );
}

export function PanelFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5', className)} {...props}>
      {children}
    </div>
  );
}

/** Signature element: an uppercase micro-heading with a hairline rule. */
export function SectionRule({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('section-rule', className)}>{children}</div>;
}

/** A stack row with the crimson left rule used for attention lists. */
export function StackItem({
  title,
  detail,
  metric,
  tone = 'neutral',
  href,
  onClick,
  className,
}: {
  title: React.ReactNode;
  detail?: React.ReactNode;
  metric?: React.ReactNode;
  tone?: 'neutral' | 'brand' | 'ok' | 'warn' | 'danger' | 'info' | 'accent';
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  const rule = {
    neutral: 'before:bg-line-strong',
    brand: 'before:bg-brand',
    ok: 'before:bg-ok',
    warn: 'before:bg-warn',
    danger: 'before:bg-danger',
    info: 'before:bg-info',
    accent: 'before:bg-accent',
  }[tone];

  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{title}</p>
        {detail ? <p className="mt-0.5 line-clamp-2 text-xs text-muted">{detail}</p> : null}
      </div>
      {metric ? <span className="tnum shrink-0 text-sm font-semibold text-ink">{metric}</span> : null}
    </>
  );

  const shared = cn('stack-item flex items-center gap-3 py-2.5 transition-colors', rule, className);

  if (href) {
    return (
      <a href={href} className={cn(shared, 'hover:bg-raised/60 rounded-r-md pr-2')}>
        {body}
      </a>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(shared, 'w-full text-left hover:bg-raised/60 rounded-r-md pr-2')}>
        {body}
      </button>
    );
  }
  return <div className={cn(shared, 'pr-2')}>{body}</div>;
}

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  delta?: number | null;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'brand' | 'info' | 'accent';
  icon?: React.ReactNode;
  href?: string;
  loading?: boolean;
}

/** One headline number with its context — not a decorative card. */
export function StatTile({ label, value, hint, delta, tone = 'neutral', icon, href, loading }: StatTileProps) {
  const accent = {
    neutral: 'bg-line-strong',
    ok: 'bg-ok',
    warn: 'bg-warn',
    danger: 'bg-danger',
    brand: 'bg-brand',
    info: 'bg-info',
    accent: 'bg-accent',
  }[tone];

  const content = (
    <div className="relative flex h-full flex-col gap-2 overflow-hidden rounded-lg border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-pop">
      <span className={cn('absolute inset-y-0 left-0 w-[3px]', accent)} aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-subtle">{label}</p>
        {icon ? <span className="text-subtle [&>svg]:h-4 [&>svg]:w-4" aria-hidden>{icon}</span> : null}
      </div>
      {loading ? (
        <div className="skeleton h-8 w-24" />
      ) : (
        <p className="tnum text-[1.75rem] font-semibold leading-none text-ink">{value}</p>
      )}
      {(hint || delta !== undefined && delta !== null) && (
        <p className="mt-auto flex items-center gap-1.5 text-xs text-muted">
          {delta !== undefined && delta !== null && !Number.isNaN(delta) ? (
            <span
              className={cn(
                'tnum inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-2xs font-semibold',
                delta > 0 ? 'bg-ok-soft text-ok-fg' : delta < 0 ? 'bg-danger-soft text-danger-fg' : 'bg-line/60 text-muted',
              )}
            >
              {delta > 0 ? '▲' : delta < 0 ? '▼' : '■'} {Math.abs(delta).toFixed(1)}
              <span className="sr-only">{delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'no change'}</span>
            </span>
          ) : null}
          {hint}
        </p>
      )}
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 rounded-lg">
        {content}
      </a>
    );
  }
  return content;
}

export function StatGrid({ children, className, columns = 4 }: { children: React.ReactNode; className?: string; columns?: 2 | 3 | 4 | 5 }) {
  const cols = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
    5: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  }[columns];
  return <div className={cn('grid grid-cols-1 gap-3', cols, className)}>{children}</div>;
}
