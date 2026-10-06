import { apiHandler, ok } from '@/server/api/handler';
import { RATE_LIMITS } from '@/server/middleware/rate-limit';
import { deleteSlot, updateSlot } from '@/server/services/timetable.service';
import { slotSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const PATCH = apiHandler(async ({ params, body, user }) => {
  const input = slotSchema.parse(body);
  return ok(
    await updateSlot(params.id, params.slotId, {
      dayOfWeek: input.dayOfWeek,
      periodIndex: input.periodIndex,
      subjectId: input.subjectId ?? null,
      facultyId: input.facultyId ?? null,
      roomId: input.roomId ?? null,
      laboratoryId: input.laboratoryId ?? null,
    }, user.id),
  );
}, { roles: ['ADMIN', 'FACULTY'], rateLimit: RATE_LIMITS.write });

export const DELETE = apiHandler(async ({ params, user }) => ok(await deleteSlot(params.id, params.slotId, user.id)), {
  roles: ['ADMIN', 'FACULTY'],
});
