'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

// ── Dropdown ────────────────────────────────────────────────────────────

export const Dropdown = DropdownMenuPrimitive.Root;
export const DropdownTrigger = DropdownMenuPrimitive.Trigger;

export function DropdownContent({
  className,
  children,
  align = 'end',
  sideOffset = 6,
}: {
  className?: string;
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[12rem] overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-pop',
          'data-[state=open]:animate-scale-in',
          className,
        )}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownItem({
  className,
  children,
  icon,
  tone = 'default',
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
  icon?: React.ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[0.8125rem] font-medium outline-none transition-colors',
        'data-[highlighted]:bg-line/60 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        tone === 'danger' ? 'text-danger-fg data-[highlighted]:bg-danger-soft' : 'text-ink',
        className,
      )}
      {...props}
    >
      {icon ? <span className="shrink-0 text-subtle [&>svg]:h-4 [&>svg]:w-4" aria-hidden>{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </DropdownMenuPrimitive.Item>
  );
}

export function DropdownLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <DropdownMenuPrimitive.Label className={cn('px-2.5 pb-1 pt-2 text-2xs font-semibold uppercase tracking-[0.12em] text-subtle', className)}>
      {children}
    </DropdownMenuPrimitive.Label>
  );
}

export const DropdownSeparator = () => <DropdownMenuPrimitive.Separator className="my-1 h-px bg-line" />;

// ── Tooltip ─────────────────────────────────────────────────────────────

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={220} skipDelayDuration={400}>{children}</TooltipPrimitive.Provider>;
}

export function Tooltip({
  label,
  children,
  side = 'top',
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}) {
  if (!label) return <>{children}</>;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 max-w-[16rem] rounded-md border border-line bg-[rgb(var(--sidebar-bg))] px-2.5 py-1.5 text-xs font-medium text-white shadow-pop',
            'data-[state=delayed-open]:animate-fade-in',
            className,
          )}
        >
          {label}
          <TooltipPrimitive.Arrow className="fill-[rgb(var(--sidebar-bg))]" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────

export interface TabItem {
  value: string;
  label: React.ReactNode;
  count?: number;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export function Tabs({
  items,
  value,
  onValueChange,
  className,
  ariaLabel,
}: {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange} className={cn('w-full', className)}>
      <TabsPrimitive.List
        aria-label={ariaLabel}
        className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line pb-px"
      >
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-1.5 px-3 py-2 text-[0.8125rem] font-medium transition-colors',
              'text-muted hover:text-ink disabled:opacity-50',
              'data-[state=active]:text-brand',
              'after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand after:opacity-0',
              'data-[state=active]:after:opacity-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
            )}
          >
            {item.icon ? <span className="[&>svg]:h-3.5 [&>svg]:w-3.5" aria-hidden>{item.icon}</span> : null}
            {item.label}
            {typeof item.count === 'number' ? (
              <span className="tnum rounded bg-line/70 px-1.5 py-0.5 text-2xs font-semibold text-muted">{item.count}</span>
            ) : null}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}
