import { apiHandler, ok } from '@/server/api/handler';
import { updateSkillGapStatus } from '@/server/services/career.service';
import { skillGapStatusSchema } from '@/validations';
import { badRequest } from '@/server/api/errors';

export const dynamic = 'force-dynamic';

export const PATCH = apiHandler(async ({ params, body, user }) => {
  if (!user.studentId) throw badRequest('A student profile is required.');
  const { status } = skillGapStatusSchema.parse(body);
  return ok(await updateSkillGapStatus(params.id, user.studentId, status));
}, { roles: ['STUDENT'] });
