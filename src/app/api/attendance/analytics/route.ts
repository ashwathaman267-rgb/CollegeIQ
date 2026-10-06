import { apiHandler, ok } from '@/server/api/handler';
import { attendanceAnalytics, facultyAttendanceQueue } from '@/server/services/attendance.service';
import { forbidden } from '@/server/api/errors';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams, user }) => {
  const [analytics, queue] = await Promise.all([
    attendanceAnalytics({
      classId: searchParams.get('classId') ?? undefined,
      subjectId: searchParams.get('subjectId') ?? undefined,
      departmentId: searchParams.get('departmentId') ?? undefined,
    }),
    user.facultyId ? facultyAttendanceQueue(user.facultyId) : null,
  ]);
  if (user.role === 'STUDENT') throw forbidden();
  return ok({ analytics, queue });
}, { roles: ['ADMIN', 'FACULTY'] });
