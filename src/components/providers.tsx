'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { TooltipProvider } from '@/components/ui/dropdown';
import { Toaster } from '@/components/ui/toaster';
import { ConfirmProvider } from '@/hooks/use-confirm';
import { ThemeProvider, useTheme } from '@/hooks/use-theme';

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme} />;
}

/**
 * Client providers: React Query (with sane caching defaults), theme,
 * tooltips and the promise-based confirm dialog.
 */
export function Providers({ children, initialTheme }: { children: React.ReactNode; initialTheme?: 'light' | 'dark' | 'system' }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider initialTheme={initialTheme}>
        <TooltipProvider>
          <ConfirmProvider>
            {children}
            <ThemedToaster />
          </ConfirmProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
