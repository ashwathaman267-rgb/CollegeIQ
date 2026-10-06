import { apiHandler, ok } from '@/server/api/handler';
import { deleteIaExam, updateIaExam } from '@/server/services/academics.service';
import { iaExamUpdateSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const PATCH = apiHandler(async ({ params, body, user }) => {
  const patch = iaExamUpdateSchema.parse(body);
  return ok(await updateIaExam(params.id, patch, user.id));
}, { roles: ['ADMIN', 'FACULTY'] });

export const DELETE = apiHandler(async ({ params, user }) => ok(await deleteIaExam(params.id, user.id)), {
  roles: ['ADMIN', 'FACULTY'],
});
