import { apiHandler, ok } from '@/server/api/handler';
import { deleteLaboratory } from '@/server/services/people.service';

export const dynamic = 'force-dynamic';

export const DELETE = apiHandler(async ({ params, user }) => ok(await deleteLaboratory(params.id, user.id)), {
  roles: ['ADMIN'],
});
