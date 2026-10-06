'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type ApiMeta } from '@/lib/api-client';

/** Debounce a fast-changing value (search boxes, filter chips). */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Track a CSS media query — drives the sidebar/tablet/mobile shell. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export const useIsMobile = () => useMediaQuery('(max-width: 639px)');
export const useIsTablet = () => useMediaQuery('(min-width: 640px) and (max-width: 1023px)');
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');

/** Stable query keys: `['api', path, query]`. */
export function queryKey(path: string, query?: Record<string, unknown>) {
  return ['api', path, query ?? {}] as const;
}

function cleanQuery(query?: Record<string, unknown>) {
  if (!query) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out;
}

export interface UseApiOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number;
  keepPreviousData?: boolean;
}

/** GET helper with a deterministic cache key and typed envelope. */
export function useApi<T>(path: string, query?: Record<string, unknown>, options: UseApiOptions = {}) {
  const cleaned = useMemo(() => cleanQuery(query), [query]);
  return useQuery({
    queryKey: queryKey(path, cleaned),
    queryFn: async () => api.get<T>(path, cleaned),
    enabled: options.enabled ?? true,
    staleTime: options.staleTime ?? 20_000,
    refetchInterval: options.refetchInterval,
    placeholderData: options.keepPreviousData ? (previous) => previous : undefined,
    retry: (failureCount, error) => {
      const status = (error as { status?: number })?.status;
      if (status && status >= 400 && status < 500) return false;
      return failureCount < 2;
    },
  });
}

/** Paginated GET: exposes rows plus the meta needed by <Pagination/>. */
export function usePagedApi<T>(path: string, query?: Record<string, unknown>, options: UseApiOptions = {}) {
  const query_ = useApi<T[]>(path, query, options);
  return { ...query_, items: query_.data?.data ?? [], meta: query_.data?.meta as ApiMeta | undefined };
}

/** Invalidate everything under a path prefix after a mutation. */
export function useInvalidate() {
  const queryClient = useQueryClient();
  return useCallback(
    (...prefixes: string[]) => {
      for (const prefix of prefixes) {
        void queryClient.invalidateQueries({
          predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[1] === 'string' && q.queryKey[1].startsWith(prefix),
        });
      }
    },
    [queryClient],
  );
}
