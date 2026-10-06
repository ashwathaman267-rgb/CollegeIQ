'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { navIcon } from '@/lib/nav-icons';
import type { NavGroupDto } from '@/lib/navigation';
import { Logo } from './logo';
import { Tooltip } from '@/components/ui/dropdown';

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface SidebarProps {
  groups: NavGroupDto[];
  institution?: { name?: string; tagline?: string; shortName?: string } | null;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  footer?: React.ReactNode;
  className?: string;
  onNavigate?: () => void;
}

/**
 * Desktop sidebar: dark, hairline separated groups, crimson active rule.
 * Collapses to an icon rail on tablets.
 */
export function Sidebar({ groups, institution, collapsed, onToggleCollapse, footer, className, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        'flex h-full flex-col bg-[rgb(var(--sidebar-bg))] text-[rgb(var(--sidebar-fg))]',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
        className,
      )}
    >
      <div className={cn('flex items-center gap-2 border-b border-[rgb(var(--sidebar-line))] px-3', collapsed ? 'h-16 justify-center px-2' : 'h-16')}>
        <Logo href="/dashboard" tone="dark" compact={collapsed} institution={institution} className="min-w-0" />
        {onToggleCollapse && !collapsed ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded text-[rgb(var(--sidebar-muted))] transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3 no-scrollbar" aria-label="Main navigation">
        {groups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-[rgb(var(--sidebar-line))]" aria-hidden />
            ) : (
              <p className="px-3 pb-1.5 text-2xs font-semibold uppercase tracking-[0.14em] text-[rgb(var(--sidebar-muted))]">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = navIcon(item.icon);
                const active = isActive(pathname, item.href);
                const link = (
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    data-active={active}
                    aria-current={active ? 'page' : undefined}
                    className={cn('nav-link', collapsed && 'justify-center px-0 py-2.5')}
                  >
                    <Icon className={cn('h-[1.05rem] w-[1.05rem] shrink-0', active ? 'text-white' : '')} aria-hidden />
                    {collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
                  </Link>
                );
                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip label={item.label} side="right">
                        <span className="block">{link}</span>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {collapsed && onToggleCollapse ? (
        <div className="border-t border-[rgb(var(--sidebar-line))] p-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="grid h-9 w-full place-items-center rounded-md text-[rgb(var(--sidebar-muted))] transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Expand sidebar"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {footer ? <div className="border-t border-[rgb(var(--sidebar-line))] px-3 py-3">{footer}</div> : null}
    </div>
  );
}
