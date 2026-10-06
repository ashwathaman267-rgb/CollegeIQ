import type { Metadata } from 'next';

import { requireRole } from '@/server/auth/guards';
import { DepartmentsView } from '@/features/structure/departments-view';

export const metadata: Metadata = { title: 'Departments' };
export const dynamic = 'force-dynamic';

export default async function DepartmentsViewPage() {
  await requireRole(['ADMIN', 'FACULTY'], '/departments');
  return <DepartmentsView />;
}
