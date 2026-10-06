'use client';

import * as React from 'react';

import { ConfirmDialog } from '@/components/ui/dialog';

interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'brand';
  children?: React.ReactNode;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

interface State extends ConfirmOptions {
  open: boolean;
}

/**
 * Promise-based confirmation. Destructive actions await `confirm(...)` and only
 * proceed when the user explicitly agrees — no accidental single-click deletes.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<State | null>(null);
  const resolver = React.useRef<((value: boolean) => void) | null>(null);

  const confirm = React.useCallback((options: ConfirmOptions) => {
    setState({ ...options, open: true });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = React.useCallback((result: boolean) => {
    setState((current) => (current ? { ...current, open: false } : current));
    resolver.current?.(result);
    resolver.current = null;
    window.setTimeout(() => setState(null), 160);
  }, []);

  const value = React.useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={state?.open ?? false}
        onOpenChange={(open) => !open && close(false)}
        title={state?.title ?? ''}
        description={state?.description}
        confirmLabel={state?.confirmLabel}
        cancelLabel={state?.cancelLabel}
        tone={state?.tone ?? 'danger'}
        onConfirm={async () => close(true)}
      >
        {state?.children}
      </ConfirmDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = React.useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return context.confirm;
}
