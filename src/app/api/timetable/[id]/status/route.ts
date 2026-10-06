import { apiHandler, ok } from '@/server/api/handler';
import { setTimetableStatus } from '@/server/services/timetable.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({ status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']) });

export const PATCH = apiHandler(async ({ params, body, user }) => {
  const { status } = schema.parse(body);
  return ok(await setTimetableStatus(params.id, status, user.id));
}, { roles: ['ADMIN', 'FACULTY'] });
