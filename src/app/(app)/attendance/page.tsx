import { Suspense } from 'react';
import type { Metadata } from 'next';

import { requireUser } from '@/server/auth/guards';
import { AttendanceView } from '@/features/attendance/attendance-view';
import { SkeletonTiles } from '@/components/ui/states';

export const metadata: Metadata = { title: 'Attendance' };
export const dynamic = 'force-dynamic';

export default async function AttendancePage() {
  await requireUser('/attendance');
  return (
    <Suspense fallback={<SkeletonTiles count={4} />}>
      <AttendanceView />
    </Suspense>
  );
}
