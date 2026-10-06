import { apiHandler, ok, readPagination } from '@/server/api/handler';
import { listUniversityResults } from '@/server/services/results.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams, user }) => {
  const { page, pageSize } = readPagination(searchParams, 12);
  const result = await listUniversityResults({
    page,
    pageSize,
    departmentId: searchParams.get('departmentId') ?? undefined,
    semester: searchParams.get('semester') ? Number(searchParams.get('semester')) : undefined,
  });
  if (user.role === 'STUDENT') {
    // Students see result sets, never other students' marks.
    return ok(result.items.map((r) => ({ ...r, passedStudents: undefined, failedStudents: undefined })), result.meta);
  }
  return ok(result.items, result.meta);
}, { roles: ['ADMIN', 'FACULTY', 'STUDENT'] });
