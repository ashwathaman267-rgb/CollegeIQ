import type { Metadata } from 'next';

import { requireRole } from '@/server/auth/guards';
import { AnalyticsView } from '@/features/admin/analytics-view';

export const metadata: Metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  await requireRole(['ADMIN', 'FACULTY'], '/analytics');
  return <AnalyticsView />;
}
