import type { Metadata } from 'next';

import { requireRole } from '@/server/auth/guards';
import { StudentsView } from '@/features/people/students-view';

export const metadata: Metadata = { title: 'Students' };
export const dynamic = 'force-dynamic';

export default async function StudentsPage() {
  await requireRole(['ADMIN', 'FACULTY', 'STUDENT'], '/students');
  return <StudentsView />;
}
