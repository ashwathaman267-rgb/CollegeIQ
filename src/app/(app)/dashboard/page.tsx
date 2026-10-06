import type { Metadata } from 'next';

import { requireUser } from '@/server/auth/guards';
import { DashboardView } from '@/features/dashboard/dashboard-view';

export const metadata: Metadata = { title: 'Overview' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  await requireUser('/dashboard');
  return <DashboardView />;
}
