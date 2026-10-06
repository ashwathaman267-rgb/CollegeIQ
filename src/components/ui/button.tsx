'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle' | 'link';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'iconSm';

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-brand text-brand-fg shadow-card hover:bg-brand-600 active:bg-brand-700 disabled:bg-brand/45 dark:hover:bg-brand-500',
  secondary:
    'bg-surface text-ink border border-line-strong hover:bg-raised hover:border-subtle active:bg-line/40',
  ghost: 'text-muted hover:text-ink hover:bg-line/50 active:bg-line/70',
  danger: 'bg-danger text-white shadow-card hover:brightness-110 active:brightness-95 disabled:opacity-50',
  subtle: 'bg-brand-soft text-brand hover:bg-brand-100 dark:hover:bg-brand-soft/80 border border-brand/15',
  link: 'text-brand underline-offset-4 hover:underline px-0 py-0 h-auto',
};

const SIZE: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded',
  sm: 'h-9 px-3 text-[0.8125rem] gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-md',
  lg: 'h-11 px-5 text-[0.9375rem] gap-2 rounded-md',
  icon: 'h-10 w-10 rounded-md justify-center',
  iconSm: 'h-8 w-8 rounded-md justify-center',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Render the child element instead of a <button> (e.g. a Next <Link>). */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', loading = false, disabled, asChild, children, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap transition-all duration-150',
        'disabled:pointer-events-none disabled:opacity-55',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'active:translate-y-px',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && !asChild ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </Comp>
  );
});

/** A row of actions with consistent spacing; wraps on small screens. */
export function ButtonGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>;
}
