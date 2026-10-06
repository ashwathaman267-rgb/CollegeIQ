'use client';

import * as React from 'react';
import { ScrollText, Terminal } from 'lucide-react';

import { formatDateTime } from '@/lib/format';
import { useApi, useDebouncedValue, usePagedApi } from '@/hooks/use-api';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, SearchInput, Select } from '@/components/ui/form';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { DataTable, type Column } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/states';

interface AuditRow {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  description: string;
  previousValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string; role: string } | null;
}

/**
 * Administrative audit trail — who changed what, when, from where, with the
 * before/after values preserved for the record.
 */
export function AuditLogsView() {
  const [search, setSearch] = React.useState('');
  const [resourceType, setResourceType] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [viewing, setViewing] = React.useState<AuditRow | null>(null);
  const debounced = useDebouncedValue(search, 300);

  const { items, meta, isLoading, error, refetch } = usePagedApi<AuditRow>('/api/audit', {
    search: debounced || undefined,
    resourceType: resourceType || undefined,
    page,
    pageSize: 20,
  });

  // Distinct resource types observed so far — the filter list comes from data.
  const knownTypes = React.useMemo(() => {
    const set = new Set<string>();
    for (const row of items) set.add(row.resourceType);
    return Array.from(set).sort();
  }, [items]);

  React.useEffect(() => setPage(1), [debounced, resourceType]);

  const columns: Column<AuditRow>[] = [
    {
      key: 'when',
      header: 'When',
      label: 'When',
      cell: (row) => <span className="tnum text-xs text-muted">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'actor',
      header: 'Actor',
      label: 'Actor',
      cell: (row) =>
        row.user ? (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar firstName={row.user.firstName} lastName={row.user.lastName} size="xs" />
            <span className="truncate text-sm text-ink">{row.user.firstName} {row.user.lastName}</span>
          </span>
        ) : (
          <Badge tone="neutral">System</Badge>
        ),
    },
    {
      key: 'action',
      header: 'Action',
      label: 'Action',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{row.action}</p>
          <p className="truncate text-xs text-muted">{row.resourceType}</p>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      primary: true,
      cell: (row) => <p className="truncate text-sm text-ink">{row.description}</p>,
    },
    {
      key: 'ip',
      header: 'IP',
      label: 'IP address',
      hideOnMobile: true,
      cell: (row) => <span className="tnum text-xs text-muted">{row.ipAddress ?? '—'}</span>,
    },
    {
      key: 'open',
      header: <span className="sr-only">Details</span>,
      align: 'right',
      cell: (row) => (
        <Button size="xs" variant="ghost" onClick={() => setViewing(row)}>
          Details
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Audit logs"
        description="A tamper-evident record of administrative actions: account changes, settings updates, deletions and data operations."
        icon={<ScrollText />}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Audit logs' }]}
      />

      <div className="mt-5 space-y-4">
        <Panel>
          <PanelBody className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
            <div className="min-w-52 flex-1">
              <Field label="Search" htmlFor="audit-search">
                <SearchInput id="audit-search" value={search} onValueChange={setSearch} placeholder="Description, action, user…" />
              </Field>
            </div>
            <div className="sm:w-56">
              <Field label="Resource type" htmlFor="audit-type">
                <Select
                  id="audit-type"
                  value={resourceType}
                  onChange={(e) => setResourceType(e.target.value)}
                  placeholder="Any resource"
                  options={knownTypes.map((t) => ({ value: t, label: t }))}
                />
              </Field>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Activity"
            subtitle={meta ? `${meta.total} event${meta.total === 1 ? '' : 's'} recorded` : undefined}
            icon={<Terminal />}
          />
          <PanelBody>
            <DataTable
              columns={columns}
              rows={items}
              rowKey={(row) => row.id}
              loading={isLoading}
              error={error}
              onRetry={refetch}
              page={meta?.page}
              pageSize={meta?.pageSize}
              total={meta?.total}
              totalPages={meta?.totalPages}
              onPageChange={setPage}
              caption="Administrative activity, newest first"
              empty={{
                title: 'No audit events match',
                description: 'Actions taken by administrators and the system are recorded here automatically.',
                icon: <ScrollText />,
              }}
            />
          </PanelBody>
        </Panel>
      </div>

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent
          title={viewing?.action ?? ''}
          size="lg"
          description={viewing ? `${viewing.resourceType} · ${formatDateTime(viewing.createdAt)}` : undefined}
        >
          {viewing ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-ink">{viewing.description}</p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Actor</dt>
                  <dd className="mt-0.5 text-ink">{viewing.user ? `${viewing.user.firstName} ${viewing.user.lastName} (${viewing.user.email})` : 'System'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Resource</dt>
                  <dd className="mt-0.5 tnum text-ink">{viewing.resourceType} {viewing.resourceId ? `· ${viewing.resourceId}` : ''}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-subtle">IP address</dt>
                  <dd className="mt-0.5 tnum text-ink">{viewing.ipAddress ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Client</dt>
                  <dd className="mt-0.5 truncate text-ink" title={viewing.userAgent ?? undefined}>
                    {viewing.userAgent ?? '—'}
                  </dd>
                </div>
              </dl>
              <div className="grid gap-3 sm:grid-cols-2">
                <JsonBlock title="Previous value" value={viewing.previousValue} />
                <JsonBlock title="New value" value={viewing.newValue} />
              </div>
            </div>
          ) : null}
          <DialogFooter className="-mx-5 -mb-4 mt-2">
            <Button variant="secondary" onClick={() => setViewing(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  const rendered = value === null || value === undefined ? null : (
    <pre className="max-h-64 overflow-auto rounded-md border border-line bg-raised p-3 text-2xs leading-relaxed text-muted">{JSON.stringify(value, null, 2)}</pre>
  );
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-subtle">{title}</p>
      {rendered ?? <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-xs text-subtle">None</p>}
    </div>
  );
}
