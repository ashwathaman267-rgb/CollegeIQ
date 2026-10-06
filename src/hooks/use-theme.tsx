'use client';

import * as React from 'react';

import { api } from '@/lib/api-client';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'campusiq.theme';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children, initialTheme }: { children: React.ReactNode; initialTheme?: Theme }) {
  const [theme, setThemeState] = React.useState<Theme>(initialTheme ?? 'system');
  const [resolvedTheme, setResolved] = React.useState<ResolvedTheme>('light');
  const hydrated = React.useRef(false);

  // Restore the stored preference once, on the client.
  React.useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    hydrated.current = true;
  }, []);

  // Honour an explicit server-side preference (signed-in user) before hydration completes.
  React.useEffect(() => {
    if (hydrated.current || !initialTheme) return;
    setThemeState(initialTheme);
  }, [initialTheme]);

  React.useEffect(() => {
    const next = theme === 'system' ? systemTheme() : theme;
    setResolved(next);
    applyTheme(next);
  }, [theme]);

  // Follow OS changes while in "system" mode.
  React.useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next = media.matches ? 'dark' : 'light';
      setResolved(next);
      applyTheme(next);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next);
    // Best-effort server sync so the preference survives a new device session.
    api.patch('/api/auth/profile', { themePreference: next }).catch(() => undefined);
  }, []);

  const value = React.useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>');
  return context;
}

/** Inline script that sets the theme class before first paint (no flash). */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
