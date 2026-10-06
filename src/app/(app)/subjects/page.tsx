import type { Metadata } from 'next';

import { requireRole } from '@/server/auth/guards';
import { SubjectsView } from '@/features/structure/subjects-view';

export const metadata: Metadata = { title: 'Subjects' };
export const dynamic = 'force-dynamic';

export default async function SubjectsViewPage() {
  await requireRole(['ADMIN', 'FACULTY'], '/subjects');
  return <SubjectsView />;
}
