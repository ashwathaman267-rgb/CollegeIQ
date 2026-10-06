import { apiHandler, ok } from '@/server/api/handler';
import { deleteRoom, updateRoom } from '@/server/services/people.service';
import { roomSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const PATCH = apiHandler(async ({ params, body, user }) => {
  const patch = roomSchema.partial().parse(body);
  return ok(await updateRoom(params.id, patch as never, user.id));
}, { roles: ['ADMIN'] });

export const DELETE = apiHandler(async ({ params, user }) => ok(await deleteRoom(params.id, user.id)), {
  roles: ['ADMIN'],
});
