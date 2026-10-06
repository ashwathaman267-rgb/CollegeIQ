import { apiHandler, ok } from '@/server/api/handler';
import { createIaExam, listIaExams, pendingAssessments } from '@/server/services/academics.service';
import { iaExamSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams, user }) => {
  const exams = await listIaExams({
    classId: searchParams.get('classId') ?? undefined,
    subjectId: searchParams.get('subjectId') ?? undefined,
    facultyId: searchParams.get('facultyId') ?? undefined,
  });
  const pending = user.facultyId ? await pendingAssessments(user.facultyId) : { pending: [], subjects: [] };
  return ok({ exams, pending: pending.pending });
}, { roles: ['ADMIN', 'FACULTY', 'STUDENT'] });

export const POST = apiHandler(async ({ body, user }) => ok(await createIaExam(iaExamSchema.parse(body), user.id)), {
  roles: ['ADMIN', 'FACULTY'],
});
