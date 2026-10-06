'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { EmptyState, ErrorState, SkeletonTable } from './states';
import { Pagination } from './pagination';

// ── Primitives (for bespoke tables) ─────────────────────────────────────

export function Table({ className, children, caption }: { className?: string; children: React.ReactNode; caption?: string }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('tbl', className)}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export const THead = ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>;
export const TBody = ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>;
export const TR = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <tr className={cn(onClick && 'cursor-pointer', className)} onClick={onClick}>
    {children}
  </tr>
);
export const TH = ({ children, className, align, sort }: { children?: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center'; sort?: React.ReactNode }) => (
  <th scope="col" className={cn(align === 'right' && 'text-right', align === 'center' && 'text-center', className)}>
    {sort ?? children}
  </th>
);
export const TD = ({ children, className, align, colSpan }: { children?: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center'; colSpan?: number }) => (
  <td className={cn(align === 'right' && 'text-right', align === 'center' && 'text-center', className)} colSpan={colSpan}>
    {children}
  </td>
);

// ── Declarative data table ──────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Used as the row label in the mobile card view. Defaults to `header`. */
  label?: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** Hidden in the mobile card list (keeps cards scannable). */
  hideOnMobile?: boolean;
  /** Rendered as the card title on mobile. Exactly one column should set this. */
  primary?: boolean;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  rowHref?: (row: T) => string;
  empty?: { title: string; description?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode };
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  sort?: { sortBy?: string; sortDir?: 'asc' | 'desc' };
  onSortChange?: (sortBy: string, sortDir: 'asc' | 'desc') => void;
  caption?: string;
  footer?: React.ReactNode;
  dense?: boolean;
}

/**
 * One table implementation that answers every screen size:
 * a real <table> on tablet and up, and a labelled card list on phones.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  onRowClick,
  rowHref,
  empty,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  sort,
  onSortChange,
  caption,
  footer,
  dense,
}: DataTableProps<T>) {
  if (loading && rows.length === 0) return <SkeletonTable rows={6} cols={Math.min(columns.length, 5)} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        title={empty?.title ?? 'Nothing here yet'}
        description={empty?.description}
        action={empty?.action}
        icon={empty?.icon}
      />
    );
  }

  const primaryColumn = columns.find((c) => c.primary) ?? columns[0];
  const detailColumns = columns.filter((c) => c !== primaryColumn && !c.hideOnMobile);

  const toggleSort = (key: string) => {
    if (!onSortChange) return;
    const next: 'asc' | 'desc' = sort?.sortBy === key && sort?.sortDir !== 'desc' ? 'desc' : 'asc';
    onSortChange(key, next);
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sort?.sortBy !== columnKey) return <ChevronsUpDown className="h-3 w-3 opacity-50" aria-hidden />;
    return sort.sortDir === 'desc' ? <ArrowDown className="h-3 w-3" aria-hidden /> : <ArrowUp className="h-3 w-3" aria-hidden />;
  };

  return (
    <div>
      {/* Desktop / tablet */}
      <div className="hidden sm:block">
        <Table caption={caption}>
          <THead>
            <tr>
              {columns.map((column) => (
                <TH key={column.key} align={column.align} className={column.className}>
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className="inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-ink"
                      aria-label={`Sort by ${typeof column.header === 'string' ? column.header : column.key}`}
                    >
                      {column.header}
                      <SortIcon columnKey={column.key} />
                    </button>
                  ) : (
                    column.header
                  )}
                </TH>
              ))}
              {(onRowClick || rowHref) && <TH className="w-8" />}
            </tr>
          </THead>
          <TBody>
            {rows.map((row) => {
              const key = rowKey(row);
              const href = rowHref?.(row);
              const content = columns.map((column) => (
                <TD key={column.key} align={column.align} className={cn(dense ? 'py-2' : undefined, column.className)}>
                  {column.cell(row)}
                </TD>
              ));
              if (href) {
                return (
                  <TR key={key} onClick={() => (window.location.href = href)}>
                    {content}
                    <TD align="right" className="text-subtle">
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </TD>
                  </TR>
                );
              }
              return (
                <TR key={key} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                  {content}
                  {onRowClick ? (
                    <TD align="right" className="text-subtle">
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </TD>
                  ) : null}
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>

      {/* Mobile: cards instead of a squeezed table */}
      <ul className="divide-y divide-line sm:hidden">
        {rows.map((row) => {
          const key = rowKey(row);
          const href = rowHref?.(row);
          const inner = (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">{primaryColumn.cell(row)}</div>
                {(onRowClick || href) && <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-subtle" aria-hidden />}
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {detailColumns.map((column) => (
                  <div key={column.key} className="min-w-0">
                    <dt className="text-2xs uppercase tracking-wide text-subtle">{column.label ?? column.header}</dt>
                    <dd className={cn('truncate text-[0.8125rem] text-ink', column.align === 'right' && 'text-right')}>{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </>
          );
          return (
            <li key={key} className="px-4 py-3">
              {href ? (
                <a href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded">
                  {inner}
                </a>
              ) : onRowClick ? (
                <button type="button" onClick={() => onRowClick(row)} className="block w-full text-left">
                  {inner}
                </button>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>

      {footer}

      {onPageChange && total !== undefined ? (
        <div className="border-t border-line px-4 py-3">
          <Pagination page={page ?? 1} pageSize={pageSize ?? 20} total={total} totalPages={totalPages ?? 1} onChange={onPageChange} />
        </div>
      ) : null}
    </div>
  );
}
