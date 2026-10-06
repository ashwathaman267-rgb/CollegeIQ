'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import type { NavGroupDto, NavItemDto } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { Sidebar } from './sidebar';
import { Topbar, type AiProviderInfo } from './topbar';
import { BottomNav, MobileDrawer } from './mobile-nav';

const COLLAPSE_KEY = 'campusiq.sidebar.collapsed';

export interface AppShellProps {
  navigation: NavGroupDto[];
  mobileNavigation: NavItemDto[];
  institution?: { name?: string; shortName?: string; tagline?: string } | null;
  ai?: AiProviderInfo | null;
  pageTitle?: string;
  children: React.ReactNode;
}

/**
 * The application chrome.
 *
 *  • desktop  → full sidebar
 *  • tablet   → collapsed icon rail with tooltips
 *  • phone    → top bar + hamburger drawer + bottom navigation
 */
export function AppShell({ navigation, mobileNavigation, institution, ai, pageTitle, children }: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Persist the rail preference and apply it once on mount (no layout shift flash).
  React.useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSE_KEY);
    if (stored === '1') setCollapsed(true);
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  // Tablet width defaults to the icon rail.
  React.useEffect(() => {
    const media = window.matchMedia('(min-width: 640px) and (max-width: 1023px)');
    const apply = () => setCollapsed(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  React.useEffect(() => setDrawerOpen(false), [pathname]);

  const toggle = React.useCallback(() => setCollapsed((value) => !value), []);

  const footer = (
    <div className="space-y-1 text-2xs leading-relaxed text-[rgb(var(--sidebar-muted))]">
      {institution?.name ? <p className="truncate font-semibold text-[rgb(var(--sidebar-fg))]">{institution.name}</p> : null}
      <p className="truncate">Intelligent Solutions for a Smarter Campus</p>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Desktop + tablet rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden sm:block" aria-label="Sidebar">
        <Sidebar groups={navigation} institution={institution} collapsed={collapsed} onToggleCollapse={toggle} footer={footer} />
      </aside>

      {/* Phone drawer */}
      <MobileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} groups={navigation} institution={institution} footer={footer} />

      <div className={cn('flex min-h-dvh flex-col transition-[padding] duration-200', collapsed ? 'sm:pl-sidebar-collapsed' : 'sm:pl-sidebar')}>
        <Topbar ai={ai} onOpenDrawer={() => setDrawerOpen(true)} title={pageTitle} />
        <main id="main" className="flex-1 px-3 pb-24 pt-4 sm:px-5 sm:pb-8 lg:px-7">
          <div className="mx-auto w-full max-w-[86rem] space-y-5">{children}</div>
        </main>
      </div>

      <BottomNav items={mobileNavigation} />
    </div>
  );
}
