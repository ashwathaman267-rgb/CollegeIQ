import type { Metadata } from 'next';

import { requireUser } from '@/server/auth/guards';
import { NotificationsView } from '@/features/notifications/notifications-view';

export const metadata: Metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  await requireUser('/notifications');
  return <NotificationsView />;
}
