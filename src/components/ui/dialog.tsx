'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from './button';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  size = 'md',
  hideClose,
}: {
  className?: string;
  children: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  hideClose?: boolean;
}) {
  const width = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[min(96rem,96vw)]',
  }[size];

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgb(12_12_18/0.55)] backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
          'max-h-[calc(100dvh-3rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-pop',
          'flex flex-col data-[state=open]:animate-scale-in',
          width,
          className,
        )}
        aria-describedby={description ? undefined : undefined}
      >
        {title ? (
          <DialogPrimitive.Title className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 text-base font-semibold text-ink">
            <span className="min-w-0">{title}</span>
          </DialogPrimitive.Title>
        ) : (
          <DialogPrimitive.Title className="sr-only">Dialog</DialogPrimitive.Title>
        )}
        {description ? (
          <DialogPrimitive.Description className="border-b border-line bg-raised px-5 py-3 text-sm text-muted">
            {description}
          </DialogPrimitive.Description>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {!hideClose ? (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md text-subtle transition-colors hover:bg-line/60 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2 border-t border-line bg-raised px-5 py-3', className)}>
      {children}
    </div>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'brand';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  /** Extra content rendered above the actions (e.g. what will be affected). */
  children?: React.ReactNode;
}

/**
 * Destructive operations always route through this dialog — no action is ever
 * taken on a single click.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent size="sm" title={title} hideClose>
        <div className="flex gap-3">
          <span
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-md',
              tone === 'danger' ? 'bg-danger-soft text-danger-fg' : 'bg-brand-soft text-brand',
            )}
            aria-hidden
          >
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0 space-y-3">
            {description ? <div className="text-sm leading-relaxed text-muted">{description}</div> : null}
            {children}
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
                {cancelLabel}
              </Button>
              <Button
                variant={tone === 'danger' ? 'danger' : 'primary'}
                size="sm"
                loading={loading}
                onClick={async () => {
                  await onConfirm();
                }}
              >
                {confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Right-hand sheet — used for filters and detail panes on desktop. */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgb(12_12_18/0.5)] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-surface shadow-pop',
            'data-[state=open]:animate-slide-in-right',
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <DialogPrimitive.Title className="text-base font-semibold text-ink">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="grid h-8 w-8 place-items-center rounded-md text-subtle transition-colors hover:bg-line/60 hover:text-ink"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
          {footer ? <div className="border-t border-line bg-raised px-4 py-3">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
