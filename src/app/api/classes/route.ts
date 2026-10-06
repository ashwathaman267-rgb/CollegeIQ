import { apiHandler, ok } from '@/server/api/handler';
import { createClass, listAcademicYears, listClasses } from '@/server/services/people.service';
import { classSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams }) => {
  const [classes, years] = await Promise.all([
    listClasses({
      departmentId: searchParams.get('departmentId') ?? undefined,
      academicYearId: searchParams.get('academicYearId') ?? undefined,
      yearOfStudy: searchParams.get('yearOfStudy') ? Number(searchParams.get('yearOfStudy')) : undefined,
    }),
    listAcademicYears(),
  ]);
  return ok({ classes, academicYears: years });
});

export const POST = apiHandler(async ({ body, user }) => ok(await createClass(classSchema.parse(body), user.id)), {
  roles: ['ADMIN'],
});
