import { apiHandler, ok } from '@/server/api/handler';
import { prisma } from '@/lib/db';
import { getSettings } from '@/server/services/settings.service';
import { buildDayGrid } from '@/server/services/timetable/grid';

export const dynamic = 'force-dynamic';

/** Everything the timetable editor needs to render its pickers. */
export const GET = apiHandler(async () => {
  const { timetable: config, academic } = await getSettings();
  const [subjects, faculty, rooms, laboratories, classes, years] = await Promise.all([
    prisma.subject.findMany({ where: { deletedAt: null }, orderBy: { code: 'asc' }, select: { id: true, code: true, name: true, subjectType: true, weeklyPeriods: true } }),
    prisma.faculty.findMany({
      where: { deletedAt: null },
      orderBy: { employeeId: 'asc' },
      include: { user: { select: { firstName: true, lastName: true } }, subjects: { select: { subjectId: true } } },
    }),
    prisma.room.findMany({ where: { deletedAt: null }, orderBy: { code: 'asc' }, select: { id: true, code: true, name: true, capacity: true, roomType: true } }),
    prisma.laboratory.findMany({ where: { deletedAt: null }, orderBy: { code: 'asc' }, select: { id: true, code: true, name: true, capacity: true } }),
    prisma.class.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        departmentId: true,
        semester: true,
        classSubjects: { select: { subject: { select: { id: true, code: true, name: true, subjectType: true, weeklyPeriods: true } } } },
      },
    }),
    prisma.academicYear.findMany({ orderBy: { startDate: 'desc' }, select: { id: true, name: true, isCurrent: true } }),
  ]);

  return ok({
    grid: buildDayGrid(config),
    config,
    academic,
    subjects,
    rooms,
    laboratories,
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      departmentId: c.departmentId,
      semester: c.semester,
      subjects: c.classSubjects.map((cs) => cs.subject),
    })),
    academicYears: years,
    faculty: faculty.map((f) => ({
      id: f.id,
      name: `${f.user.firstName} ${f.user.lastName}`,
      employeeId: f.employeeId,
      subjectIds: f.subjects.map((s) => s.subjectId),
    })),
  });
});
