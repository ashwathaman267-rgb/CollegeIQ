import type { Metadata } from 'next';

import { requireRole } from '@/server/auth/guards';
import { AuditLogsView } from '@/features/admin/audit-logs-view';

export const metadata: Metadata = { title: 'Audit logs' };
export const dynamic = 'force-dynamic';

export default async function AuditLogsPage() {
  await requireRole(['ADMIN'], '/audit-logs');
  return <AuditLogsView />;
}
