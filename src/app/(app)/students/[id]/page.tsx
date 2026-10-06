import type { Metadata } from 'next';

import { requireRole } from '@/server/auth/guards';
import { StudentProfile } from '@/features/people/student-profile';

export const metadata: Metadata = { title: 'Student profile' };
export const dynamic = 'force-dynamic';

export default async function StudentProfilePage({ params }: { params: { id: string } }) {
  await requireRole(['ADMIN', 'FACULTY', 'STUDENT'], `/students/${params.id}`);
  return <StudentProfile studentId={params.id} />;
}
