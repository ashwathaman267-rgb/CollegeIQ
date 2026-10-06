import { apiHandler, ok } from '@/server/api/handler';
import { updateSkillGapsForSkill } from '@/server/services/career.service';
import { skillGapByNameSchema } from '@/validations';
import { badRequest } from '@/server/api/errors';

export const dynamic = 'force-dynamic';

/** Update the tracked status of every gap for one skill across all analyses. */
export const PATCH = apiHandler(async ({ body, user }) => {
  if (!user.studentId) throw badRequest('A student profile is required.');
  const input = skillGapByNameSchema.parse(body);
  return ok(await updateSkillGapsForSkill(user.studentId, input.skillName, input.status));
}, { roles: ['STUDENT'] });
