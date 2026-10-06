import { apiHandler, ok } from '@/server/api/handler';
import { studentResultHistory } from '@/server/services/results.service';
import { forbidden } from '@/server/api/errors';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ user }) => {
  if (!user.studentId) throw forbidden('A student profile is required.');
  return ok(await studentResultHistory(user.studentId));
}, { roles: ['STUDENT'] });
