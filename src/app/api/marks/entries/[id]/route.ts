import { apiHandler, ok } from '@/server/api/handler';
import { deleteMark } from '@/server/services/academics.service';

export const dynamic = 'force-dynamic';

export const DELETE = apiHandler(async ({ params, user }) => ok(await deleteMark(params.id, user.id)), {
  roles: ['ADMIN', 'FACULTY'],
});
