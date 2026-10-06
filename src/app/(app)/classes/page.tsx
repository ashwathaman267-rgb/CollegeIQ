import type { Metadata } from 'next';

import { requireRole } from '@/server/auth/guards';
import { ClassesView } from '@/features/structure/classes-view';

export const metadata: Metadata = { title: 'Classes' };
export const dynamic = 'force-dynamic';

export default async function ClassesViewPage() {
  await requireRole(['ADMIN', 'FACULTY'], '/classes');
  return <ClassesView />;
}
