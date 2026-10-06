'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { NavGroupDto, NavItemDto } from '@/lib/navigation';
import { toastError, toastSuccess } from '@/components/ui/toaster';

export interface SessionUser {
  id: string;
  email: string;
  role: 'STUDENT' | 'FACULTY' | 'ADMIN';
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  themePreference: string;
  studentId: string | null;
  facultyId: string | null;
  registerNumber: string | null;
  employeeId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  classId: string | null;
  className: string | null;
}

export interface SessionPayload {
  user: SessionUser;
  navigation: NavGroupDto[];
  mobileNavigation: NavItemDto[];
  capabilities: Record<string, boolean>;
  institution: { name: string; shortName: string; tagline: string; address: string; email: string; phone: string; website: string };
  thresholds: { safe: number; fine: number; debar: number; countLateAsPresent: boolean };
  academic: { semester: number; currentAcademicYearId: string | null; currentAcademicYearName: string | null; iaExamCount: number; passMarkPercentage: number };
  ai: { provider: string; label: string; model?: string; live: boolean; reason?: string };
}

export const SESSION_KEY = ['session'] as const;

export function useSession() {
  const query = useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => (await api.get<SessionPayload>('/api/auth/session')).data,
    staleTime: 60_000,
    retry: false,
  });
  return {
    ...query,
    session: query.data,
    user: query.data?.user ?? null,
    capabilities: query.data?.capabilities ?? {},
    institution: query.data?.institution,
    thresholds: query.data?.thresholds,
    academic: query.data?.academic,
    ai: query.data?.ai,
    navigation: query.data?.navigation ?? [],
    mobileNavigation: query.data?.mobileNavigation ?? [],
    can: (capability: string) => Boolean(query.data?.capabilities?.[capability]),
  };
}

export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post('/api/auth/logout');
    },
    onSuccess: () => {
      queryClient.clear();
      router.push('/login');
      router.refresh();
    },
    onError: (error) => toastError(error, 'Could not sign you out.'),
  });
}

/** Shared mutation wrapper: toasts on success/failure and refetches given keys. */
export function useApiMutation<TVariables, TResult = unknown>(options: {
  mutationFn: (variables: TVariables) => Promise<TResult>;
  successMessage?: string | ((result: TResult, variables: TVariables) => string);
  errorMessage?: string;
  invalidate?: unknown[][];
  onSuccess?: (result: TResult, variables: TVariables) => void;
  onError?: (error: unknown, variables: TVariables) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: (result, variables) => {
      if (options.successMessage) {
        toastSuccess(typeof options.successMessage === 'function' ? options.successMessage(result, variables) : options.successMessage);
      }
      for (const key of options.invalidate ?? []) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      options.onSuccess?.(result, variables);
    },
    onError: (error, variables) => {
      toastError(error, options.errorMessage);
      options.onError?.(error, variables);
    },
  });
}

/** Small helper for filter/pagination state kept in the URL-agnostic component state. */
export function usePagedFilters<T extends Record<string, unknown>>(initial: T) {
  const [filters, setFilters] = React.useState<T & { page: number }>({ ...initial, page: 1 } as T & { page: 1 });

  const update = React.useCallback((patch: Partial<T> | ((current: T) => Partial<T>)) => {
    setFilters((current) => {
      const next = typeof patch === 'function' ? patch(current) : patch;
      return { ...current, ...next, page: 1 } as T & { page: number };
    });
  }, []);

  const setPage = React.useCallback((page: number) => {
    setFilters((current) => ({ ...current, page }));
  }, []);

  const reset = React.useCallback(() => {
    setFilters({ ...initial, page: 1 } as T & { page: 1 });
  }, [initial]);

  return { filters, update, setPage, reset, setFilters };
}
