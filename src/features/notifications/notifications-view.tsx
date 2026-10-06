'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Bell, BellOff, CheckCheck, Trash2 } from 'lucide-react';

import { api } from '@/lib/api-client';
import { relativeTime } from '@/lib/utils';
import { useApi, useInvalidate, usePagedApi } from '@/hooks/use-api';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Select } from '@/components/ui/form';
import { Panel, PanelBody, PanelHeader, StatGrid, StatTile } from '@/components/ui/panel';
import { EmptyState, SkeletonRows } from '@/components/ui/states';
import { toastError, toastSuccess } from '@/components/ui/toaster';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

const TYPE_TONE: Record<string, 'brand' | 'ok' | 'warn' | 'danger' | 'info' | 'neutral'> = {
  ATTENDANCE_ALERT: 'warn',
  RESULT_PUBLISHED: 'ok',
  TIMETABLE_UPDATED: 'info',
  CAREER_INSIGHT: 'brand',
  ACADEMIC: 'info',
  SYSTEM: 'neutral',
};

const TYPE_OPTIONS = [
  { value: 'ATTENDANCE_ALERT', label: 'Attendance alerts' },
  { value: 'RESULT_PUBLISHED', label: 'Results published' },
  { value: 'TIMETABLE_UPDATED', label: 'Timetable updates' },
  { value: 'CAREER_INSIGHT', label: 'Career insights' },
  { value: 'ACADEMIC', label: 'Academic' },
  { value: 'SYSTEM', label: 'System' },
];

/**
 * Full notification history — the same feed as the top-bar bell, with
 * filtering, unread handling and per-item actions.
 */
export function NotificationsView() {
  const [type, setType] = React.useState('');
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [page, setPage] = React.useState(1);

  const query = usePagedApi<NotificationRow>('/api/notifications', {
    type: type || undefined,
    unreadOnly: unreadOnly || undefined,
    page,
    pageSize: 20,
  });
  const counts = useApi<{ items: NotificationRow[]; unread: number }>('/api/notifications', { pageSize: 1 });
  const invalidate = useInvalidate();

  const items = query.items;
  const meta = query.meta;
  const unread = counts.data?.data?.unread ?? 0;

  React.useEffect(() => setPage(1), [type, unreadOnly]);

  const toggleRead = async (row: NotificationRow) => {
    try {
      await api.patch(`/api/notifications/${row.id}`, { read: !row.isRead });
      invalidate('/api/notifications');
    } catch (error) {
      toastError(error, 'Could not update that notification.');
    }
  };

  const markAll = async () => {
    try {
      await api.patch('/api/notifications');
      invalidate('/api/notifications');
      toastSuccess('All notifications marked as read');
    } catch (error) {
      toastError(error, 'Could not mark everything as read.');
    }
  };

  const remove = async (row: NotificationRow) => {
    try {
      await api.delete(`/api/notifications/${row.id}`);
      invalidate('/api/notifications');
    } catch (error) {
      toastError(error, 'Could not delete that notification.');
    }
  };

  const totalByType = (counts.data?.data?.items ?? []).reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Everything CampusIQ has flagged for you: attendance risk, published results, timetable changes and career insights."
        icon={<Bell />}
        breadcrumbs={[{ label: 'Home', href: '/dashboard' }, { label: 'Notifications' }]}
        actions={
          unread > 0 ? (
            <Button variant="primary" size="sm" onClick={() => void markAll()}>
              <CheckCheck className="h-4 w-4" aria-hidden />
              Mark all as read
            </Button>
          ) : null
        }
      />

      <div className="mt-5 space-y-4">
        <StatGrid columns={3}>
          <StatTile label="Unread" value={unread} tone={unread ? 'warn' : 'ok'} icon={<Bell />} />
          <StatTile
            label="Total on this device"
            value={meta?.total ?? '—'}
            hint="Stored against your account, not the browser"
            icon={<BellOff />}
          />
          <StatTile
            label="Attendance alerts"
            value={totalByType.ATTENDANCE_ALERT ?? '—'}
            hint="Most recent page only"
            tone={totalByType.ATTENDANCE_ALERT ? 'warn' : 'neutral'}
            icon={<Bell />}
          />
        </StatGrid>

        <Panel>
          <PanelBody className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
            <div className="sm:w-64">
              <Field label="Type" htmlFor="not-type">
                <Select
                  id="not-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="All types"
                  options={TYPE_OPTIONS}
                />
              </Field>
            </div>
            <div className="pb-1.5">
              <Checkbox id="not-unread" label="Unread only" checked={unreadOnly} onCheckedChange={(checked) => setUnreadOnly(Boolean(checked))} />
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="History" subtitle={meta ? `${meta.total} notification${meta.total === 1 ? '' : 's'}` : undefined} />
          <PanelBody>
            {query.isLoading ? (
              <SkeletonRows rows={6} />
            ) : query.error ? (
              <p className="py-6 text-center text-sm text-muted">
                Could not load notifications.{' '}
                <Button variant="link" size="xs" onClick={() => query.refetch()}>
                  Try again
                </Button>
              </p>
            ) : items.length === 0 ? (
              <EmptyState
                icon={<Bell />}
                title={unreadOnly ? 'Nothing unread' : 'No notifications yet'}
                description={
                  unreadOnly
                    ? 'You are all caught up. Clear the filter to see your full history.'
                    : 'Alerts about attendance, results, timetables and career analysis will appear here.'
                }
              />
            ) : (
              <>
                <ul className="divide-y divide-line">
                  {items.map((row) => (
                    <li key={row.id} className={`flex items-start gap-3 py-3 ${row.isRead ? '' : 'bg-brand-soft/20 -mx-2 rounded-md px-2'}`}>
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${row.isRead ? 'bg-line-strong' : 'bg-brand'}`}
                        aria-hidden
                        title={row.isRead ? 'Read' : 'Unread'}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={`text-sm ${row.isRead ? 'font-medium text-muted' : 'font-semibold text-ink'}`}>{row.title}</p>
                          <Badge tone={TYPE_TONE[row.type] ?? 'neutral'}>{row.type.replace(/_/g, ' ').toLowerCase()}</Badge>
                        </div>
                        <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">{row.message}</p>
                        <p className="mt-1 text-xs text-subtle">
                          {relativeTime(new Date(row.createdAt))}
                          {row.readAt ? ` · read ${relativeTime(new Date(row.readAt))}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {row.link ? (
                          <Button size="xs" variant="ghost" asChild>
                            <Link href={row.link}>
                              Open
                              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                            </Link>
                          </Button>
                        ) : null}
                        <Button
                          size="xs"
                          variant="ghost"
                          aria-label={row.isRead ? 'Mark as unread' : 'Mark as read'}
                          title={row.isRead ? 'Mark as unread' : 'Mark as read'}
                          onClick={() => void toggleRead(row)}
                        >
                          {row.isRead ? <BellOff className="h-3.5 w-3.5" aria-hidden /> : <CheckCheck className="h-3.5 w-3.5" aria-hidden />}
                        </Button>
                        <Button size="xs" variant="ghost" className="text-danger-fg hover:text-danger" aria-label="Delete notification" onClick={() => void remove(row)}>
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                {meta && (meta.totalPages ?? 1) > 1 ? (
                  <div className="mt-4 flex items-center justify-between">
                    <Button size="xs" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                      Previous
                    </Button>
                    <span className="tnum text-xs text-muted">
                      Page {meta.page} of {meta.totalPages}
                    </span>
                    <Button size="xs" variant="secondary" disabled={page >= (meta.totalPages ?? 1)} onClick={() => setPage(page + 1)}>
                      Next
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
