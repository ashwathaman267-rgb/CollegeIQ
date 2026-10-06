'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';

import { api } from '@/lib/api-client';
import { relativeTime } from '@/lib/utils';
import { useApi, useInvalidate } from '@/hooks/use-api';
import { Dropdown, DropdownContent, DropdownTrigger } from '@/components/ui/dropdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, SkeletonRows } from '@/components/ui/states';
import { toastError, toastSuccess } from '@/components/ui/toaster';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
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

export function NotificationsMenu() {
  const router = useRouter();
  const invalidate = useInvalidate();
  const [open, setOpen] = React.useState(false);
  const query = useApi<{ items: NotificationRow[]; unread: number }>('/api/notifications', { pageSize: 8 }, { refetchInterval: 60_000 });

  const items = query.data?.data?.items ?? [];
  const unread = query.data?.data?.unread ?? 0;

  const markAll = async () => {
    try {
      await api.patch('/api/notifications');
      toastSuccess('All notifications marked as read');
      invalidate('/api/notifications', '/api/dashboard');
    } catch (error) {
      toastError(error, 'Could not update notifications.');
    }
  };

  const openNotification = async (notification: NotificationRow) => {
    setOpen(false);
    if (!notification.isRead) {
      api.patch(`/api/notifications/${notification.id}`, { read: true }).catch(() => undefined);
      invalidate('/api/notifications');
    }
    router.push(notification.link ?? '/notifications');
  };

  return (
    <Dropdown open={open} onOpenChange={setOpen}>
      <DropdownTrigger
        className="relative grid h-9 w-9 place-items-center rounded-md border border-line bg-surface text-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/45"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="tnum absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[0.625rem] font-bold leading-none text-brand-fg">
            {unread > 9 ? '9+' : unread}
            <span className="sr-only"> unread notifications</span>
          </span>
        ) : null}
      </DropdownTrigger>

      <DropdownContent align="end" className="w-[min(23rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
          <p className="text-[0.8125rem] font-semibold text-ink">Notifications</p>
          {unread > 0 ? (
            <button type="button" onClick={markAll} className="inline-flex items-center gap-1 text-xs font-medium text-brand transition-opacity hover:opacity-80">
              <CheckCheck className="h-3.5 w-3.5" aria-hidden />
              Mark all read
            </button>
          ) : null}
        </div>

        <div className="max-h-[22rem] overflow-y-auto">
          {query.isLoading ? (
            <div className="p-3.5">
              <SkeletonRows rows={4} />
            </div>
          ) : items.length === 0 ? (
            <EmptyState compact title="You are all caught up" description="Attendance alerts, results and timetable changes will show up here." />
          ) : (
            <ul className="divide-y divide-line">
              {items.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => void openNotification(notification)}
                    className={`flex w-full gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-raised ${notification.isRead ? '' : 'bg-brand-soft/40'}`}
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden>
                      <span className={notification.isRead ? 'block h-1.5 w-1.5 rounded-full bg-line-strong' : 'block h-1.5 w-1.5 rounded-full bg-brand'} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[0.8125rem] font-medium text-ink">{notification.title}</span>
                        <Badge tone={TYPE_TONE[notification.type] ?? 'neutral'}>{notification.type.replace(/_/g, ' ').toLowerCase()}</Badge>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{notification.message}</span>
                      <span className="mt-1 block text-2xs text-subtle">{relativeTime(notification.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-line bg-raised px-3.5 py-2">
          <Button variant="ghost" size="sm" className="w-full justify-center" asChild>
            <Link href="/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </DropdownContent>
    </Dropdown>
  );
}
