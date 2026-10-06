'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CornerDownLeft, Loader2, Search } from 'lucide-react';

import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/use-api';

interface SearchGroup {
  label: string;
  items: { id: string; title: string; subtitle?: string; href: string; badge?: string }[];
}

/**
 * Global search (⌘K / Ctrl-K). Results are grouped by kind and every entry
 * links straight to the record, so search is navigation rather than a dead end.
 */
export function GlobalSearch({ placeholder = 'Search students, subjects, pages…' }: { placeholder?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [term, setTerm] = React.useState('');
  const [groups, setGroups] = React.useState<SearchGroup[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [active, setActive] = React.useState(0);
  const debounced = useDebouncedValue(term, 250);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    if (debounced.trim().length < 2) {
      setGroups([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<SearchGroup[]>('/api/search', { q: debounced.trim() })
      .then((result) => {
        if (cancelled) return;
        setGroups(result.data ?? []);
        setActive(0);
        setError(null);
      })
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, open]);

  const flat = React.useMemo(() => groups.flatMap((g) => g.items.map((item) => ({ ...item, group: g.label }))), [groups]);

  const go = (href: string) => {
    setOpen(false);
    setTerm('');
    router.push(href);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!flat.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => (current + 1) % flat.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => (current - 1 + flat.length) % flat.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(flat[active].href);
    }
  };

  let cursor = -1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group hidden h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-[0.8125rem] text-subtle transition-colors hover:border-line-strong hover:text-muted md:flex md:w-64 lg:w-80"
        aria-label="Open search"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="flex-1 truncate text-left">{placeholder}</span>
        <kbd className="rounded border border-line bg-raised px-1.5 py-0.5 font-sans text-2xs font-semibold text-subtle">⌘K</kbd>
      </button>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgb(12_12_18/0.55)] backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-pop data-[state=open]:animate-scale-in"
            onKeyDown={onKeyDown}
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <DialogPrimitive.Title className="sr-only">Search CampusIQ</DialogPrimitive.Title>
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search className="h-4 w-4 shrink-0 text-subtle" aria-hidden />
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder={placeholder}
                className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-subtle"
                aria-label="Search"
                autoComplete="off"
              />
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden /> : null}
              <DialogPrimitive.Close className="rounded px-1.5 py-0.5 text-2xs font-semibold uppercase text-subtle transition-colors hover:text-ink" aria-label="Close search">
                Esc
              </DialogPrimitive.Close>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
              {term.trim().length < 2 ? (
                <p className="px-3 py-8 text-center text-[0.8125rem] text-muted">
                  Type at least two characters to search students, faculty, subjects, classes, results and pages.
                </p>
              ) : error ? (
                <p className="px-3 py-8 text-center text-[0.8125rem] text-danger-fg" role="alert">
                  {error}
                </p>
              ) : loading && !flat.length ? (
                <div className="space-y-2 p-2" aria-busy="true">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="skeleton h-9 w-full rounded-md" />
                  ))}
                </div>
              ) : flat.length === 0 ? (
                <p className="px-3 py-8 text-center text-[0.8125rem] text-muted">
                  No matches for “{term.trim()}”. Try a register number, a subject code or a page name.
                </p>
              ) : (
                groups.map((group) => (
                  <div key={group.label} className="mb-1.5">
                    <p className="px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-[0.12em] text-subtle">{group.label}</p>
                    <ul>
                      {group.items.map((item) => {
                        cursor += 1;
                        const index = cursor;
                        return (
                          <li key={`${group.label}-${item.id}`}>
                            <button
                              type="button"
                              onMouseEnter={() => setActive(index)}
                              onClick={() => go(item.href)}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                                index === active ? 'bg-brand-soft' : 'hover:bg-line/50',
                              )}
                              aria-current={index === active}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[0.8125rem] font-medium text-ink">{item.title}</span>
                                {item.subtitle ? <span className="block truncate text-xs text-muted">{item.subtitle}</span> : null}
                              </span>
                              {item.badge ? (
                                <span className="shrink-0 rounded border border-line bg-raised px-1.5 py-0.5 text-2xs font-semibold uppercase text-muted">
                                  {item.badge}
                                </span>
                              ) : null}
                              {index === active ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden /> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line bg-raised px-4 py-2 text-2xs text-subtle">
              <span>
                <kbd className="rounded border border-line bg-surface px-1 font-sans">↑</kbd>{' '}
                <kbd className="rounded border border-line bg-surface px-1 font-sans">↓</kbd> to navigate
              </span>
              <span>
                <kbd className="rounded border border-line bg-surface px-1 font-sans">↵</kbd> to open
              </span>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
