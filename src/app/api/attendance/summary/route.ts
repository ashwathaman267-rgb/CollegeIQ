import { apiHandler, ok } from '@/server/api/handler';
import { studentAttendanceSummary } from '@/server/services/attendance.service';
import { forbidden } from '@/server/api/errors';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams, user }) => {
  const requested = searchParams.get('studentId');
  const studentId = user.role === 'STUDENT' ? user.studentId : requested;
  if (!studentId) throw forbidden('Select a student to view attendance.');
  if (user.role === 'STUDENT' && requested && requested !== user.studentId) throw forbidden();

  const from = searchParams.get('from');
  const to = searchParams.get('to');
  return ok(
    await studentAttendanceSummary(studentId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      subjectId: searchParams.get('subjectId') ?? undefined,
    }),
  );
}, { roles: ['ADMIN', 'FACULTY', 'STUDENT'] });
