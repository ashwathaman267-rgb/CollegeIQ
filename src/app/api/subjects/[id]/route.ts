import { apiHandler, ok } from '@/server/api/handler';
import { deleteSubject, updateSubject } from '@/server/services/people.service';
import { subjectSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const PATCH = apiHandler(async ({ params, body, user }) => {
  const patch = subjectSchema.partial().parse(body);
  return ok(await updateSubject(params.id, patch, user.id));
}, { roles: ['ADMIN'] });

export const DELETE = apiHandler(async ({ params, user }) => ok(await deleteSubject(params.id, user.id)), {
  roles: ['ADMIN'],
});
