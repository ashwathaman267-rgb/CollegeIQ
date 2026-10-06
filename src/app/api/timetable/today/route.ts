import { apiHandler, ok } from '@/server/api/handler';
import { todaysSchedule } from '@/server/services/timetable.service';
import { badRequest } from '@/server/api/errors';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams, user }) => {
  const classId = searchParams.get('classId') ?? user.classId ?? undefined;
  const facultyId = searchParams.get('facultyId') ?? user.facultyId ?? undefined;
  if (!classId && !facultyId) throw badRequest('No schedule is linked to your account yet.');
  return ok(await todaysSchedule(facultyId && !classId ? { facultyId } : { classId }));
});
