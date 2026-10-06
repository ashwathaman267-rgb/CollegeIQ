import { apiHandler, ok } from '@/server/api/handler';
import { createLaboratory, listLaboratories } from '@/server/services/people.service';
import { laboratorySchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams }) =>
  ok(await listLaboratories({ departmentId: searchParams.get('departmentId') ?? undefined })),
);

export const POST = apiHandler(async ({ body, user }) => ok(await createLaboratory(laboratorySchema.parse(body), user.id)), {
  roles: ['ADMIN'],
});
