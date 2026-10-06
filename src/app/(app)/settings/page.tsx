import type { Metadata } from 'next';

import { requireUser } from '@/server/auth/guards';
import { SettingsView } from '@/features/admin/settings-view';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requireUser('/settings');
  return <SettingsView />;
}
