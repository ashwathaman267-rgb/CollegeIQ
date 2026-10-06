import * as React from 'react';
import { cn } from '@/lib/utils';
import { Breadcrumbs, type Crumb } from '@/components/ui/breadcrumbs';

export interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Every screen opens with the same header shape so the three questions are
 * answered immediately: what is this, what can I do here, what needs attention.
 */
export function PageHeader({ title, description, breadcrumbs, actions, meta, icon, className, children }: PageHeaderProps) {
  return (
    <header className={cn('space-y-3', className)}>
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <span className="mt-0.5 hidden h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand sm:grid [&>svg]:h-5 [&>svg]:w-5" aria-hidden>
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-tight text-ink sm:text-[1.375rem]">{title}</h1>
            {description ? <p className="mt-1 max-w-3xl text-[0.8125rem] leading-relaxed text-muted">{description}</p> : null}
            {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}
