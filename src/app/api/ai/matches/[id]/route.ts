import { apiHandler, ok } from '@/server/api/handler';
import { deleteMatch, getMatch } from '@/server/services/career.service';
import { badRequest } from '@/server/api/errors';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ params, user }) => {
  if (!user.studentId) throw badRequest('A student profile is required.');
  return ok(await getMatch(params.id, user.studentId, user.role));
}, { roles: ['STUDENT', 'FACULTY', 'ADMIN'] });

export const DELETE = apiHandler(async ({ params, user }) => {
  if (!user.studentId) throw badRequest('A student profile is required.');
  return ok(await deleteMatch(params.id, user.studentId));
}, { roles: ['STUDENT'] });
