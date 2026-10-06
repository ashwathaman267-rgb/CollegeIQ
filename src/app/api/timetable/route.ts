import { apiHandler, ok } from '@/server/api/handler';
import {
  activeTimetableForClass,
  facultyTimetable,
  laboratoryTimetable,
  listTimetables,
  roomTimetable,
} from '@/server/services/timetable.service';
import { badRequest } from '@/server/api/errors';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams, user }) => {
  const view = searchParams.get('view') ?? 'class';
  const academicYearId = searchParams.get('academicYearId') ?? undefined;

  if (view === 'faculty') {
    const facultyId = searchParams.get('facultyId') ?? user.facultyId;
    if (!facultyId) throw badRequest('Select a faculty member.');
    return ok(await facultyTimetable(facultyId, academicYearId));
  }
  if (view === 'room') {
    const roomId = searchParams.get('roomId');
    if (!roomId) throw badRequest('Select a room.');
    return ok(await roomTimetable(roomId, academicYearId));
  }
  if (view === 'laboratory') {
    const laboratoryId = searchParams.get('laboratoryId');
    if (!laboratoryId) throw badRequest('Select a laboratory.');
    return ok(await laboratoryTimetable(laboratoryId, academicYearId));
  }

  const classId = searchParams.get('classId') ?? user.classId;
  if (!classId) throw badRequest('Select a class.');
  const [timetables, active] = await Promise.all([
    listTimetables({ classId, academicYearId, status: (searchParams.get('status') as never) ?? undefined }),
    activeTimetableForClass(classId),
  ]);
  return ok({ timetables, active });
});
