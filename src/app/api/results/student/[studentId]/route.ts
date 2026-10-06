import { apiHandler, ok } from '@/server/api/handler';
import { studentResultHistory } from '@/server/services/results.service';
import { forbidden } from '@/server/api/errors';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ params, user }) => {
  if (user.role === 'STUDENT' && user.studentId !== params.studentId) throw forbidden();
  return ok(await studentResultHistory(params.studentId));
}, { roles: ['ADMIN', 'FACULTY', 'STUDENT'] });
