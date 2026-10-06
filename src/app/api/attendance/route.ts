import { apiHandler, ok } from '@/server/api/handler';
import { RATE_LIMITS } from '@/server/middleware/rate-limit';
import { saveAttendanceSession } from '@/server/services/attendance.service';
import { markAttendanceSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async ({ body, user }) => {
  const input = markAttendanceSchema.parse(body);
  const result = await saveAttendanceSession({
    facultyId: user.facultyId as string,
    actorUserId: user.id,
    subjectId: input.subjectId,
    classId: input.classId,
    date: input.date,
    periodIndex: input.periodIndex,
    startTime: input.startTime,
    endTime: input.endTime,
    topic: input.topic ?? undefined,
    notes: input.notes ?? undefined,
    status: input.status,
    records: input.records,
  });
  return ok(result);
}, { roles: ['FACULTY', 'ADMIN'], facultyProfile: true, rateLimit: RATE_LIMITS.write });
