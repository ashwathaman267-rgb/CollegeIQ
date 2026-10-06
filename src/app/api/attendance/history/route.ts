import { apiHandler, ok, readPagination } from '@/server/api/handler';
import { studentAttendanceHistory } from '@/server/services/attendance.service';
import { attendanceStatus } from '@/validations';
import { forbidden } from '@/server/api/errors';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams, user }) => {
  const requested = searchParams.get('studentId');
  const studentId = user.role === 'STUDENT' ? user.studentId : requested;
  if (!studentId) throw forbidden('Select a student to view attendance history.');
  if (user.role === 'STUDENT' && requested && requested !== user.studentId) throw forbidden();

  const { page, pageSize } = readPagination(searchParams);
  const statusParam = searchParams.get('status');
  const status = statusParam ? attendanceStatus.parse(statusParam) : undefined;

  const result = await studentAttendanceHistory(studentId, {
    page,
    pageSize,
    status,
    subjectId: searchParams.get('subjectId') ?? undefined,
    from: searchParams.get('from') ? new Date(searchParams.get('from') as string) : undefined,
    to: searchParams.get('to') ? new Date(searchParams.get('to') as string) : undefined,
  });
  return ok(result.items, result.meta);
}, { roles: ['ADMIN', 'FACULTY', 'STUDENT'] });
