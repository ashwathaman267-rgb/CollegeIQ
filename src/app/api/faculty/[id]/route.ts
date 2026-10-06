import { apiHandler, ok } from '@/server/api/handler';
import { deleteFaculty, getFacultyProfile, updateFaculty } from '@/server/services/people.service';
import { facultyUpdateSchema } from '@/validations';
import { forbidden } from '@/server/api/errors';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ params, user }) => {
  if (user.role === 'FACULTY' && user.facultyId !== params.id) throw forbidden();
  return ok(await getFacultyProfile(params.id));
}, { roles: ['ADMIN', 'FACULTY'] });

export const PATCH = apiHandler(async ({ params, body, user }) => {
  const patch = facultyUpdateSchema.parse(body);
  return ok(await updateFaculty(params.id, patch, user.id));
}, { roles: ['ADMIN'] });

export const DELETE = apiHandler(async ({ params, user }) => ok(await deleteFaculty(params.id, user.id)), {
  roles: ['ADMIN'],
});
