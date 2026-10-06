'use client';

import * as React from 'react';
import { cn, initials } from '@/lib/utils';

const SIZES = {
  xs: 'h-6 w-6 text-2xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-[0.8125rem]',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
} as const;

/** Deterministic tint per person, so a list is scannable without rainbow noise. */
function tintFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  const tints = [
    'bg-brand-soft text-brand',
    'bg-info-soft text-info-fg',
    'bg-ok-soft text-ok-fg',
    'bg-accent-soft text-accent',
    'bg-warn-soft text-warn-fg',
    'bg-line/60 text-muted',
  ];
  return tints[hash % tints.length];
}

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  src?: string | null;
  size?: keyof typeof SIZES;
  square?: boolean;
}

export function Avatar({ name, firstName, lastName, src, size = 'md', square, className, ...props }: AvatarProps) {
  const label = name ?? [firstName, lastName].filter(Boolean).join(' ') ?? 'User';
  const [initial1, initial2] = initials(firstName ?? label.split(' ')[0], lastName ?? label.split(' ')[1] ?? '');

  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center border font-semibold uppercase select-none',
        square ? 'rounded-md' : 'rounded-full',
        SIZES[size],
        src ? 'border-line bg-raised' : cn('border-transparent', tintFor(label)),
        className,
      )}
      title={label}
      aria-hidden={src ? undefined : undefined}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className={cn('h-full w-full object-cover', square ? 'rounded-md' : 'rounded-full')} />
      ) : (
        <span aria-hidden>
          {initial1}
          {initial2}
        </span>
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PersonCell({
  name,
  meta,
  src,
  size = 'sm',
  className,
}: {
  name: string;
  meta?: React.ReactNode;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <Avatar name={name} src={src} size={size} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">{name}</p>
        {meta ? <p className="truncate text-xs text-muted">{meta}</p> : null}
      </div>
    </div>
  );
}
