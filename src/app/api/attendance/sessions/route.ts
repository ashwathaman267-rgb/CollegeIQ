import { apiHandler, ok, readPagination } from '@/server/api/handler';
import { listAttendanceSessions } from '@/server/services/attendance.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams, user }) => {
  const { page, pageSize } = readPagination(searchParams);
  const result = await listAttendanceSessions({
    page,
    pageSize,
    classId: searchParams.get('classId') ?? undefined,
    subjectId: searchParams.get('subjectId') ?? undefined,
    facultyId: user.role === 'FACULTY' ? (user.facultyId ?? undefined) : (searchParams.get('facultyId') ?? undefined),
    from: searchParams.get('from') ? new Date(searchParams.get('from') as string) : undefined,
    to: searchParams.get('to') ? new Date(searchParams.get('to') as string) : undefined,
  });
  return ok(result.items, result.meta);
}, { roles: ['ADMIN', 'FACULTY'] });
