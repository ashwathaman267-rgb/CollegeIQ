import { apiHandler, ok } from '@/server/api/handler';
import { deleteStudent, getStudentProfile, updateStudent } from '@/server/services/people.service';
import { studentAttendanceSummary } from '@/server/services/attendance.service';
import { studentPerformance } from '@/server/services/academics.service';
import { studentResultHistory } from '@/server/services/results.service';
import { studentUpdateSchema } from '@/validations';
import { forbidden } from '@/server/api/errors';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ params, user }) => {
  if (user.role === 'STUDENT' && user.studentId !== params.id) throw forbidden();
  const [profile, attendance, academics, results] = await Promise.all([
    getStudentProfile(params.id),
    studentAttendanceSummary(params.id),
    studentPerformance(params.id),
    studentResultHistory(params.id),
  ]);
  return ok({ profile, attendance, academics, results });
}, { roles: ['ADMIN', 'FACULTY', 'STUDENT'] });

export const PATCH = apiHandler(async ({ params, body, user }) => {
  const patch = studentUpdateSchema.parse(body);
  return ok(await updateStudent(params.id, patch, user.id));
}, { roles: ['ADMIN'] });

export const DELETE = apiHandler(async ({ params, user }) => ok(await deleteStudent(params.id, user.id)), {
  roles: ['ADMIN'],
});
