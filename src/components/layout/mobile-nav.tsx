'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { navIcon } from '@/lib/nav-icons';
import type { NavGroupDto, NavItemDto } from '@/lib/navigation';
import { Sidebar } from './sidebar';

/** Phone navigation: a fixed bottom bar for the five primary destinations. */
export function BottomNav({ items }: { items: NavItemDto[] }) {
  const pathname = usePathname();
  if (!items.length) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85 safe-bottom lg:hidden"
      aria-label="Primary"
    >
      <ul className="flex items-stretch justify-between">
        {items.map((item) => {
          const Icon = navIcon(item.icon);
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-14 flex-col items-center justify-center gap-1 text-2xs font-medium transition-colors',
                  active ? 'text-brand' : 'text-subtle hover:text-ink',
                )}
              >
                <span className={cn('absolute inset-x-4 top-0 h-0.5 rounded-full transition-colors', active ? 'bg-brand' : 'bg-transparent')} aria-hidden />
                <Icon className="h-[1.15rem] w-[1.15rem]" aria-hidden />
                <span className="max-w-full truncate px-1">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Hamburger-triggered drawer holding the full navigation on phones. */
export function MobileDrawer({
  open,
  onOpenChange,
  groups,
  institution,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: NavGroupDto[];
  institution?: { name?: string; tagline?: string } | null;
  footer?: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
      <button
        type="button"
        className="absolute inset-0 bg-[rgb(12_12_18/0.55)] backdrop-blur-[2px] animate-fade-in"
        onClick={() => onOpenChange(false)}
        aria-label="Close navigation"
      />
      <div className="absolute inset-y-0 left-0 flex w-[17rem] max-w-[85vw] flex-col animate-slide-in-left">
        <div className="absolute right-2 top-3 z-10">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid h-8 w-8 place-items-center rounded-md text-[rgb(var(--sidebar-muted))] transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <Sidebar groups={groups} institution={institution} footer={footer} onNavigate={() => onOpenChange(false)} className="w-full" />
      </div>
    </div>
  );
}

export function MenuButton({ onClick, label = 'Open navigation' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-md border border-line bg-surface text-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45 lg:hidden"
      aria-label={label}
    >
      <Menu className="h-4 w-4" />
    </button>
  );
}
