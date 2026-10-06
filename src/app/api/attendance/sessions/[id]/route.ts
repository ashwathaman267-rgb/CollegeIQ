import { apiHandler, ok } from '@/server/api/handler';
import { deleteAttendanceSession } from '@/server/services/attendance.service';

export const dynamic = 'force-dynamic';

export const DELETE = apiHandler(async ({ params, user }) => ok(await deleteAttendanceSession(params.id, user.id)), {
  roles: ['ADMIN', 'FACULTY'],
});
