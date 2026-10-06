'use client';

import * as React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useTheme, type Theme } from '@/hooks/use-theme';
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownTrigger } from '@/components/ui/dropdown';
import { Tooltip } from '@/components/ui/dropdown';

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
  { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
];

/** Light / dark / system, persisted locally and on the user profile. */
export function ThemeToggle({ className, variant = 'icon' }: { className?: string; variant?: 'icon' | 'menu' }) {
  const { theme, setTheme } = useTheme();

  if (variant === 'menu') {
    return (
      <Dropdown>
        <DropdownTrigger
          className={cn(
            'grid h-9 w-9 place-items-center rounded-md border border-line bg-surface text-muted transition-colors hover:border-line-strong hover:text-ink',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45',
            className,
          )}
          aria-label={`Theme: ${theme}. Change theme`}
        >
          {OPTIONS.find((o) => o.value === theme)?.icon ?? <Monitor className="h-4 w-4" />}
        </DropdownTrigger>
        <DropdownContent align="end" className="min-w-[10rem]">
          <DropdownLabel>Appearance</DropdownLabel>
          {OPTIONS.map((option) => (
            <DropdownItem key={option.value} icon={option.icon} onSelect={() => setTheme(option.value)}>
              {option.label}
              {theme === option.value ? <span className="ml-auto text-2xs font-semibold uppercase text-brand">Active</span> : null}
            </DropdownItem>
          ))}
        </DropdownContent>
      </Dropdown>
    );
  }

  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-md border border-line bg-raised p-0.5', className)} role="group" aria-label="Theme">
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <Tooltip key={option.value} label={`${option.label} theme`}>
            <button
              type="button"
              onClick={() => setTheme(option.value)}
              aria-pressed={active}
              className={cn(
                'grid h-7 w-7 place-items-center rounded transition-colors',
                active ? 'bg-surface text-ink shadow-card' : 'text-subtle hover:text-ink',
              )}
            >
              {option.icon}
              <span className="sr-only">{option.label} theme</span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
