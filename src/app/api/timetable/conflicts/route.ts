import { apiHandler, ok } from '@/server/api/handler';
import { conflictCount, detectConflicts } from '@/server/services/timetable.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams }) => {
  const academicYearId = searchParams.get('academicYearId') ?? undefined;
  const timetableId = searchParams.get('timetableId') ?? undefined;
  const [conflicts, counts] = await Promise.all([
    detectConflicts(timetableId ? { timetableId } : { academicYearId }),
    conflictCount(academicYearId),
  ]);
  return ok({ conflicts, ...counts });
}, { roles: ['ADMIN', 'FACULTY'] });
