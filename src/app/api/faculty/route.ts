import { apiHandler, ok, readPagination } from '@/server/api/handler';
import { createFaculty, listFaculty } from '@/server/services/people.service';
import { facultySchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams }) => {
  const { page, pageSize, search } = readPagination(searchParams);
  const result = await listFaculty({
    page,
    pageSize,
    search,
    departmentId: searchParams.get('departmentId') ?? undefined,
  });
  return ok(result.items, result.meta);
}, { roles: ['ADMIN', 'FACULTY'] });

export const POST = apiHandler(async ({ body, user }) => ok(await createFaculty(facultySchema.parse(body), user.id)), {
  roles: ['ADMIN'],
});
