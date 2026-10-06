import { apiHandler, ok } from '@/server/api/handler';
import { createSubject, listSubjects } from '@/server/services/people.service';
import { subjectSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams }) => {
  const search = searchParams.get('search')?.trim() || undefined;
  const rows = await listSubjects({
    search,
    departmentId: searchParams.get('departmentId') ?? undefined,
    semester: searchParams.get('semester') ? Number(searchParams.get('semester')) : undefined,
    subjectType: (searchParams.get('subjectType') as never) ?? undefined,
  });
  return ok(rows);
});

export const POST = apiHandler(async ({ body, user }) => ok(await createSubject(subjectSchema.parse(body), user.id)), {
  roles: ['ADMIN'],
});
