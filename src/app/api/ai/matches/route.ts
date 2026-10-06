import { apiHandler, ok } from '@/server/api/handler';
import { RATE_LIMITS } from '@/server/middleware/rate-limit';
import { analyzeMatch, listMatches, studentSkillGaps } from '@/server/services/career.service';
import { matchSchema } from '@/validations';
import { badRequest } from '@/server/api/errors';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = apiHandler(async ({ user }) => {
  if (!user.studentId) throw badRequest('A student profile is required.');
  const [matches, gaps] = await Promise.all([listMatches(user.studentId), studentSkillGaps(user.studentId)]);
  return ok({ matches, gaps });
}, { roles: ['STUDENT'] });

export const POST = apiHandler(async ({ body, user }) => {
  if (!user.studentId) throw badRequest('A student profile is required.');
  const input = matchSchema.parse(body);
  return ok(
    await analyzeMatch({
      resumeId: input.resumeId,
      jobDescriptionId: input.jobDescriptionId,
      studentId: user.studentId,
      actorUserId: user.id,
    }),
  );
}, { roles: ['STUDENT'], rateLimit: RATE_LIMITS.ai });
