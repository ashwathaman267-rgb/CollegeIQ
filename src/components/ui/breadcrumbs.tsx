import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length <= 1) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {item.href && !last ? (
                <Link href={item.href} className="truncate rounded transition-colors hover:text-brand hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className="truncate font-medium text-ink" aria-current={last ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
              {!last ? <ChevronRight className="h-3 w-3 shrink-0 text-subtle" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
