import { apiHandler, ok } from '@/server/api/handler';
import { classPerformance, studentPerformance } from '@/server/services/academics.service';
import { forbidden } from '@/server/api/errors';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams, user }) => {
  const classId = searchParams.get('classId');
  const studentId = searchParams.get('studentId') ?? (user.role === 'STUDENT' ? user.studentId : null);

  if (user.role === 'STUDENT') {
    if (!studentId) throw forbidden();
    return ok({ student: await studentPerformance(studentId) });
  }
  if (!classId) throw forbidden('Select a class to view performance.');
  return ok({ class: await classPerformance(classId) });
}, { roles: ['ADMIN', 'FACULTY', 'STUDENT'] });
