import { apiHandler, ok } from '@/server/api/handler';
import { markingRoster } from '@/server/services/attendance.service';
import { rosterQuerySchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams }) => {
  const input = rosterQuerySchema.parse({
    classId: searchParams.get('classId'),
    subjectId: searchParams.get('subjectId'),
    date: searchParams.get('date') ?? undefined,
    periodIndex: searchParams.get('periodIndex') ?? undefined,
    sessionId: searchParams.get('sessionId') ?? undefined,
  });
  return ok(await markingRoster(input));
}, { roles: ['ADMIN', 'FACULTY'] });
