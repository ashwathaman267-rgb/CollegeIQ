import { apiHandler, ok } from '@/server/api/handler';
import { deleteClass, updateClass } from '@/server/services/people.service';
import { classPerformance } from '@/server/services/academics.service';
import { attendanceAnalytics } from '@/server/services/attendance.service';
import { classUpdateSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ params }) => {
  const [performance, attendance] = await Promise.all([
    classPerformance(params.id),
    attendanceAnalytics({ classId: params.id }),
  ]);
  return ok({ performance, attendance });
}, { roles: ['ADMIN', 'FACULTY'] });

export const PATCH = apiHandler(async ({ params, body, user }) => {
  const patch = classUpdateSchema.parse(body);
  return ok(await updateClass(params.id, patch, user.id));
}, { roles: ['ADMIN'] });

export const DELETE = apiHandler(async ({ params, user }) => ok(await deleteClass(params.id, user.id)), {
  roles: ['ADMIN'],
});
