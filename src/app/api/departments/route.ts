import { apiHandler, ok } from '@/server/api/handler';
import { createDepartment, listDepartments } from '@/server/services/people.service';
import { departmentSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => ok(await listDepartments()));

export const POST = apiHandler(async ({ body, user }) => ok(await createDepartment(departmentSchema.parse(body), user.id)), {
  roles: ['ADMIN'],
});
