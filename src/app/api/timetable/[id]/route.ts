import { apiHandler, ok } from '@/server/api/handler';
import { deleteTimetable, getTimetable } from '@/server/services/timetable.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ params }) => ok(await getTimetable(params.id)));

export const DELETE = apiHandler(async ({ params, user }) => ok(await deleteTimetable(params.id, user.id)), {
  roles: ['ADMIN', 'FACULTY'],
});
