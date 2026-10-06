import { apiHandler, ok } from '@/server/api/handler';
import { createRoom, listLaboratories, listRooms } from '@/server/services/people.service';
import { roomSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams }) => {
  const [rooms, laboratories] = await Promise.all([
    listRooms({
      roomType: (searchParams.get('roomType') as never) ?? undefined,
      departmentId: searchParams.get('departmentId') ?? undefined,
      search: searchParams.get('search') ?? undefined,
    }),
    listLaboratories({ departmentId: searchParams.get('departmentId') ?? undefined }),
  ]);
  return ok({ rooms, laboratories });
});

export const POST = apiHandler(async ({ body, user }) => ok(await createRoom(roomSchema.parse(body), user.id)), {
  roles: ['ADMIN'],
});
