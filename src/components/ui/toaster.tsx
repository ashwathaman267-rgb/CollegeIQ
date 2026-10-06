'use client';

import { Toaster as Sonner, toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

import { ApiError } from '@/lib/api-client';

/**
 * Sonner wired to the CampusIQ palette. Toasts are the only feedback channel
 * for background mutations, so every helper states what actually happened.
 */
export function Toaster({ theme = 'system' }: { theme?: 'light' | 'dark' | 'system' }) {
  return (
    <Sonner
      theme={theme}
      position="top-right"
      closeButton
      richColors={false}
      duration={5000}
      toastOptions={{
        style: {
          background: 'rgb(var(--surface))',
          border: '1px solid rgb(var(--line))',
          color: 'rgb(var(--ink))',
          boxShadow: '0 12px 32px -8px rgb(16 16 24 / 0.18)',
          borderRadius: '0.625rem',
          fontSize: '0.875rem',
        },
        classNames: {
          title: 'text-[0.875rem] font-semibold text-ink',
          description: 'text-xs text-muted',
          actionButton: 'bg-brand text-brand-fg rounded-md text-xs font-medium',
          cancelButton: 'bg-line/60 text-muted rounded-md text-xs font-medium',
          closeButton: 'bg-surface border-line',
          success: '[&>[data-icon]]:text-ok',
          error: '[&>[data-icon]]:text-danger',
          warning: '[&>[data-icon]]:text-warn',
          info: '[&>[data-icon]]:text-info',
        },
      }}
      icons={{
        success: <CheckCircle2 className="h-4 w-4 text-ok" />,
        error: <XCircle className="h-4 w-4 text-danger" />,
        warning: <AlertTriangle className="h-4 w-4 text-warn" />,
        info: <Info className="h-4 w-4 text-info" />,
      }}
    />
  );
}

export { toast };

/** Turn any thrown value (usually an ApiError) into a user-facing toast. */
export function toastError(error: unknown, fallback = 'That did not work. Please try again.') {
  const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : fallback;
  const description =
    error instanceof ApiError && error.fieldErrors.length
      ? error.fieldErrors.slice(0, 3).map((f) => (f.field ? `${f.field}: ${f.message}` : f.message)).join(' · ')
      : undefined;
  return toast.error(message, { description });
}

export const toastSuccess = (message: string, description?: string) => toast.success(message, { description });
export const toastInfo = (message: string, description?: string) => toast.info(message, { description });
export const toastWarning = (message: string, description?: string) => toast.warning(message, { description });
