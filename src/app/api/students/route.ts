import { apiHandler, ok, readPagination } from '@/server/api/handler';
import { listStudents, createStudent } from '@/server/services/people.service';
import { studentSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams, user }) => {
  const { page, pageSize, search, sortBy, sortDir } = readPagination(searchParams);
  const result = await listStudents({
    page,
    pageSize,
    search,
    sortBy: sortBy as 'registerNumber' | 'name' | 'cgpa' | undefined,
    sortDir,
    departmentId: searchParams.get('departmentId') ?? undefined,
    classId: searchParams.get('classId') ?? undefined,
    yearOfStudy: searchParams.get('yearOfStudy') ? Number(searchParams.get('yearOfStudy')) : undefined,
    section: searchParams.get('section') ?? undefined,
    atRiskOnly: searchParams.get('atRisk') === 'true',
    // Faculty only ever see students they teach; students only see themselves.
    ...(user.role === 'FACULTY' && user.facultyId
      ? {}
      : user.role === 'STUDENT'
        ? { search: user.registerNumber ?? search }
        : {}),
  });
  return ok(result.items, result.meta);
}, { roles: ['ADMIN', 'FACULTY', 'STUDENT'] });

export const POST = apiHandler(async ({ body, user }) => {
  const input = studentSchema.parse(body);
  return ok(await createStudent(input, user.id));
}, { roles: ['ADMIN'] });
