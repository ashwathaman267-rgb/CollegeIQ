import { apiHandler, ok } from '@/server/api/handler';
import { RATE_LIMITS } from '@/server/middleware/rate-limit';
import { generateTimetable } from '@/server/services/timetable.service';
import { generateTimetableSchema } from '@/validations';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export const POST = apiHandler(async ({ body, user }) => {
  const input = generateTimetableSchema.parse(body);
  return ok(
    await generateTimetable({
      classId: input.classId,
      academicYearId: input.academicYearId,
      actorUserId: user.id,
      publish: input.publish,
      seed: input.seed,
    }),
  );
}, { roles: ['ADMIN', 'FACULTY'], rateLimit: { limit: 10, windowMs: 60_000, bucket: 'generate' } });
