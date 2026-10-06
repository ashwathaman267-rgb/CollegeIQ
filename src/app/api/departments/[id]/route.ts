import { apiHandler, ok } from '@/server/api/handler';
import { deleteDepartment, updateDepartment } from '@/server/services/people.service';
import { departmentSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const PATCH = apiHandler(async ({ params, body, user }) => {
  const patch = departmentSchema.partial().parse(body);
  return ok(await updateDepartment(params.id, patch, user.id));
}, { roles: ['ADMIN'] });

export const DELETE = apiHandler(async ({ params, user }) => ok(await deleteDepartment(params.id, user.id)), {
  roles: ['ADMIN'],
});
