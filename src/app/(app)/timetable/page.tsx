import type { Metadata } from 'next';

import { requireUser } from '@/server/auth/guards';
import { TimetableView } from '@/features/timetable/timetable-view';

export const metadata: Metadata = { title: 'Timetable' };
export const dynamic = 'force-dynamic';

export default async function TimetablePage() {
  await requireUser('/timetable');
  return <TimetableView />;
}
