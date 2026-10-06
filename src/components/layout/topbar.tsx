'use client';

import * as React from 'react';
import { Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';
import { GlobalSearch } from './global-search';
import { NotificationsMenu } from './notifications-menu';
import { UserMenu } from './user-menu';
import { ThemeToggle } from './theme-toggle';
import { MenuButton } from './mobile-nav';
import { Tooltip } from '@/components/ui/dropdown';

export interface AiProviderInfo {
  provider: string;
  label: string;
  model?: string;
  live: boolean;
  reason?: string;
}

/** Small badge that tells the truth about which AI engine is answering. */
export function AiBadge({ ai, className }: { ai?: AiProviderInfo | null; className?: string }) {
  if (!ai) return null;
  return (
    <Tooltip
      label={
        ai.live
          ? `Live AI provider: ${ai.model ?? ai.label}. Keys stay on the server.`
          : `${ai.reason ?? 'No AI API key configured'} — CampusIQ is using its built-in deterministic engine, so every feature still works.`
      }
    >
      <span
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-2xs font-semibold',
          ai.live ? 'border-ok/30 bg-ok-soft text-ok-fg' : 'border-line bg-raised text-muted',
          className,
        )}
      >
        <Sparkles className={cn('h-3 w-3', ai.live ? 'text-ok' : 'text-subtle')} aria-hidden />
        {ai.label}
        <span className={cn('h-1.5 w-1.5 rounded-full', ai.live ? 'bg-ok animate-pulse-soft' : 'bg-line-strong')} aria-hidden />
        <span className="sr-only">{ai.live ? 'Connected to a live AI provider' : 'Built-in analysis engine'}</span>
      </span>
    </Tooltip>
  );
}

export function Topbar({
  ai,
  onOpenDrawer,
  className,
  title,
}: {
  ai?: AiProviderInfo | null;
  onOpenDrawer?: () => void;
  className?: string;
  title?: string;
}) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-canvas/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-canvas/70 sm:px-5',
        className,
      )}
    >
      {onOpenDrawer ? <MenuButton onClick={onOpenDrawer} /> : null}
      {title ? <p className="truncate text-sm font-semibold text-ink lg:hidden">{title}</p> : null}
      <div className="ml-auto flex items-center gap-2 lg:ml-0 lg:flex-1">
        <div className="hidden flex-1 md:block">
          <GlobalSearch />
        </div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <AiBadge ai={ai} className="hidden sm:inline-flex" />
          <ThemeToggle variant="menu" className="hidden sm:grid" />
          <NotificationsMenu />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
