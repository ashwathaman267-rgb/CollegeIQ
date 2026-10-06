import { apiHandler, ok } from '@/server/api/handler';
import { deleteResume, getResume, updateResume } from '@/server/services/career.service';
import { resumeUpdateSchema } from '@/validations';
import { badRequest } from '@/server/api/errors';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ params, user }) => {
  if (!user.studentId) throw badRequest('A student profile is required.');
  return ok(await getResume(params.id, user.studentId));
}, { roles: ['STUDENT'] });

export const PATCH = apiHandler(async ({ params, body, user }) => {
  if (!user.studentId) throw badRequest('A student profile is required.');
  return ok(await updateResume(params.id, user.studentId, resumeUpdateSchema.parse(body)));
}, { roles: ['STUDENT'] });

export const DELETE = apiHandler(async ({ params, user }) => {
  if (!user.studentId) throw badRequest('A student profile is required.');
  return ok(await deleteResume(params.id, user.studentId, user.id));
}, { roles: ['STUDENT'] });
