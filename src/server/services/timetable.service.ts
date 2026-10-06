import type { DayOfWeek, Prisma, TimetableStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { badRequest, notFound } from '@/server/api/errors';
import { groupBy, round } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { getSettings } from './settings.service';
import { audit } from './audit.service';
import { notifyMany } from './notification.service';
import { buildDayGrid, DAY_LABEL, DAY_SHORT, fromMinutes, gridLabel, toMinutes, violatesBreak, outsideWorkingHours, type GridSlot } from './timetable/grid';
import { generateSchedule, type LabOption, type RoomOption, type SchedulerSubject, type SchedulerWarning } from './timetable/scheduler';

export const getDayGrid = async (): Promise<GridSlot[]> => {
  const { timetable } = await getSettings();
  return buildDayGrid(timetable);
};

// ─────────────────────────────────────────────────────────────────────────
// Reading
// ─────────────────────────────────────────────────────────────────────────

export interface TimetableCell {
  slotId: string;
  day: DayOfWeek;
  index: number;
  teachingIndex: number | null;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  label: string;
  subjectId?: string | null;
  subjectCode?: string | null;
  subjectName?: string | null;
  subjectType?: string | null;
  facultyId?: string | null;
  facultyName?: string | null;
  roomId?: string | null;
  roomCode?: string | null;
  laboratoryId?: string | null;
  laboratoryName?: string | null;
  classId?: string | null;
  className?: string | null;
}

const slotInclude = {
  subject: { select: { id: true, code: true, name: true, subjectType: true } },
  faculty: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
  room: { select: { id: true, code: true, name: true } },
  laboratory: { select: { id: true, name: true, code: true } },
  class: { select: { id: true, name: true } },
} satisfies Prisma.TimetableSlotInclude;

type SlotWithRelations = Prisma.TimetableSlotGetPayload<{ include: typeof slotInclude }>;

function toCell(slot: SlotWithRelations, grid: Map<number, GridSlot>): TimetableCell {
  const g = grid.get(slot.periodIndex);
  return {
    slotId: slot.id,
    day: slot.dayOfWeek,
    index: slot.periodIndex,
    teachingIndex: slot.isBreak ? null : (g?.teachingIndex ?? slot.periodIndex),
    startTime: slot.startTime,
    endTime: slot.endTime,
    isBreak: slot.isBreak,
    label: slot.isBreak ? (slot.breakLabel ?? 'Break') : (slot.subject?.name ?? 'Free'),
    subjectId: slot.subject?.id ?? null,
    subjectCode: slot.subject?.code ?? null,
    subjectName: slot.subject?.name ?? null,
    subjectType: slot.subject?.subjectType ?? null,
    facultyId: slot.faculty?.id ?? null,
    facultyName: slot.faculty ? `${slot.faculty.user.firstName} ${slot.faculty.user.lastName}` : null,
    roomId: slot.room?.id ?? null,
    roomCode: slot.room?.code ?? null,
    laboratoryId: slot.laboratory?.id ?? null,
    laboratoryName: slot.laboratory?.name ?? null,
    classId: slot.classId,
    className: slot.class?.name ?? null,
  };
}

async function gridMap() {
  const grid = await getDayGrid();
  return new Map(grid.map((s) => [s.index, s]));
}

export async function listTimetables(filter: { academicYearId?: string; classId?: string; status?: TimetableStatus } = {}) {
  const where: Prisma.TimetableWhereInput = {
    deletedAt: null,
    ...(filter.academicYearId ? { academicYearId: filter.academicYearId } : {}),
    ...(filter.classId ? { classId: filter.classId } : {}),
    ...(filter.status ? { status: filter.status } : {}),
  };
  const rows = await prisma.timetable.findMany({
    where,
    orderBy: [{ classId: 'asc' }, { version: 'desc' }],
    include: {
      class: { select: { id: true, name: true, section: true, yearOfStudy: true } },
      academicYear: { select: { id: true, name: true } },
      _count: { select: { slots: true } },
    },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    version: t.version,
    status: t.status,
    generatedAt: t.generatedAt.toISOString(),
    notes: t.notes,
    slotCount: t._count.slots,
    classId: t.classId,
    className: t.class.name,
    academicYearId: t.academicYearId,
    academicYearName: t.academicYear.name,
  }));
}

/** Latest non-archived timetable for a class (published wins over draft). */
export async function activeTimetableForClass(classId: string) {
  const timetable = await prisma.timetable.findFirst({
    where: { classId, deletedAt: null, status: { not: 'ARCHIVED' } },
    orderBy: [{ status: 'desc' }, { version: 'desc' }],
    include: { slots: { include: slotInclude, orderBy: [{ dayOfWeek: 'asc' }, { periodIndex: 'asc' }] } },
  });
  if (!timetable) return null;
  const grid = await gridMap();
  return {
    timetable: {
      id: timetable.id,
      name: timetable.name,
      version: timetable.version,
      status: timetable.status,
      generatedAt: timetable.generatedAt.toISOString(),
      notes: timetable.notes,
      conflicts: timetable.conflicts as unknown,
      metrics: timetable.metrics as unknown,
      classId: timetable.classId,
    },
    cells: timetable.slots.map((s) => toCell(s, grid)),
  };
}

export async function getTimetable(id: string) {
  const timetable = await prisma.timetable.findUnique({
    where: { id },
    include: {
      slots: { include: slotInclude, orderBy: [{ dayOfWeek: 'asc' }, { periodIndex: 'asc' }] },
      class: { select: { id: true, name: true } },
      academicYear: { select: { id: true, name: true } },
    },
  });
  if (!timetable || timetable.deletedAt) throw notFound('That timetable does not exist.');
  const grid = await gridMap();
  return {
    timetable: {
      id: timetable.id,
      name: timetable.name,
      version: timetable.version,
      status: timetable.status,
      generatedAt: timetable.generatedAt.toISOString(),
      notes: timetable.notes,
      conflicts: timetable.conflicts as unknown,
      metrics: timetable.metrics as unknown,
      classId: timetable.classId,
      className: timetable.class.name,
      academicYearId: timetable.academicYearId,
      academicYearName: timetable.academicYear.name,
    },
    cells: timetable.slots.map((s) => toCell(s, grid)),
  };
}

/** Every class a faculty member teaches in the current year. */
export async function facultyTimetable(facultyId: string, academicYearId?: string) {
  const where: Prisma.TimetableSlotWhereInput = {
    facultyId,
    timetable: { deletedAt: null, status: { not: 'ARCHIVED' }, ...(academicYearId ? { academicYearId } : {}) },
  };
  const [slots, grid] = await Promise.all([
    prisma.timetableSlot.findMany({ where, include: slotInclude }),
    gridMap(),
  ]);
  const latest = latestSlotPerGrid(slots);
  return { cells: latest.map((s) => toCell(s, grid)), count: latest.length };
}

export async function roomTimetable(roomId: string, academicYearId?: string) {
  const [slots, grid] = await Promise.all([
    prisma.timetableSlot.findMany({
      where: { roomId, timetable: { deletedAt: null, status: { not: 'ARCHIVED' }, ...(academicYearId ? { academicYearId } : {}) } },
      include: slotInclude,
    }),
    gridMap(),
  ]);
  const latest = latestSlotPerGrid(slots);
  return { cells: latest.map((s) => toCell(s, grid)), count: latest.length };
}

export async function laboratoryTimetable(laboratoryId: string, academicYearId?: string) {
  const [slots, grid] = await Promise.all([
    prisma.timetableSlot.findMany({
      where: {
        laboratoryId,
        timetable: { deletedAt: null, status: { not: 'ARCHIVED' }, ...(academicYearId ? { academicYearId } : {}) },
      },
      include: slotInclude,
    }),
    gridMap(),
  ]);
  const latest = latestSlotPerGrid(slots);
  return { cells: latest.map((s) => toCell(s, grid)), count: latest.length };
}

/** When several class timetables overlap, keep the most recently generated slot. */
function latestSlotPerGrid(slots: SlotWithRelations[]) {
  const byKey = new Map<string, SlotWithRelations>();
  for (const slot of slots) {
    const k = `${slot.dayOfWeek}|${slot.periodIndex}`;
    const existing = byKey.get(k);
    if (!existing || slot.timetableId > existing.timetableId) byKey.set(k, slot);
  }
  return Array.from(byKey.values());
}

// ─────────────────────────────────────────────────────────────────────────
// Generation
// ─────────────────────────────────────────────────────────────────────────

export interface GenerateInput {
  classId: string;
  academicYearId: string;
  actorUserId: string;
  publish?: boolean;
  seed?: number;
}

export interface GenerateOutput {
  timetableId: string;
  version: number;
  status: TimetableStatus;
  placements: number;
  warnings: SchedulerWarning[];
  conflicts: ConflictEntry[];
  metrics: Record<string, unknown>;
}

export async function generateTimetable(input: GenerateInput): Promise<GenerateOutput> {
  const { timetable: config } = await getSettings();

  const klass = await prisma.class.findUnique({
    where: { id: input.classId },
    include: {
      department: true,
      classSubjects: {
        include: {
          subject: true,
        },
      },
      _count: { select: { students: true } },
    },
  });
  if (!klass || klass.deletedAt) throw notFound('That class does not exist.');
  if (klass.classSubjects.length === 0) {
    throw badRequest('This class has no subjects assigned yet. Add subjects before generating a timetable.');
  }

  // Faculty assignment: prefer an explicit subject+class mapping, else any
  // faculty member teaching the subject.
  const assignments = await prisma.facultySubject.findMany({
    where: { subjectId: { in: klass.classSubjects.map((cs) => cs.subjectId) } },
    include: { faculty: { select: { id: true, user: { select: { firstName: true, lastName: true } } } } },
  });
  const assignmentBySubjectClass = new Map(assignments.filter((a) => a.classId).map((a) => [`${a.subjectId}|${a.classId}`, a]));
  const assignmentBySubject = new Map<string, (typeof assignments)[number]>();
  for (const a of assignments) if (!assignmentBySubject.has(a.subjectId)) assignmentBySubject.set(a.subjectId, a);

  const subjects: SchedulerSubject[] = klass.classSubjects.map((cs) => {
    const assignment = assignmentBySubjectClass.get(`${cs.subjectId}|${input.classId}`) ?? assignmentBySubject.get(cs.subjectId);
    const lab = cs.subject.subjectType === 'LABORATORY';
    return {
      subjectId: cs.subject.id,
      code: cs.subject.code,
      name: cs.subject.name,
      subjectType: cs.subject.subjectType,
      weeklyPeriods: cs.subject.weeklyPeriods,
      periodsPerSession: lab ? Math.max(2, cs.subject.periodsPerSession) : cs.subject.periodsPerSession,
      facultyId: assignment?.faculty.id ?? null,
      facultyName: assignment ? `${assignment.faculty.user.firstName} ${assignment.faculty.user.lastName}` : null,
    };
  });

  const facultyIds = subjects.map((s) => s.facultyId).filter((f): f is string => Boolean(f));

  const [availabilityRows, otherTimetables, rooms, laboratories] = await Promise.all([
    prisma.facultyAvailability.findMany({ where: { facultyId: { in: facultyIds } } }),
    prisma.timetable.findMany({
      where: {
        academicYearId: input.academicYearId,
        classId: { not: input.classId },
        deletedAt: null,
        status: { not: 'ARCHIVED' },
      },
      orderBy: { version: 'desc' },
      include: { slots: { select: { dayOfWeek: true, periodIndex: true, facultyId: true, roomId: true, laboratoryId: true } } },
    }),
    prisma.room.findMany({
      where: { deletedAt: null, roomType: { in: ['CLASSROOM', 'SEMINAR_HALL'] } },
      select: { id: true, code: true, name: true, capacity: true },
    }),
    prisma.laboratory.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, name: true, capacity: true, rooms: { select: { id: true }, take: 1 } },
    }),
  ]);

  const unavailable = new Map<string, Set<string>>();
  for (const row of availabilityRows) {
    if (row.isAvailable) continue;
    const set = unavailable.get(row.facultyId) ?? new Set<string>();
    set.add(`${row.dayOfWeek}|${row.periodIndex}`);
    unavailable.set(row.facultyId, set);
  }

  // Keep only the newest timetable per class so old drafts do not block slots.
  const newestPerClass = new Map<string, (typeof otherTimetables)[number]>();
  for (const t of otherTimetables) {
    const existing = newestPerClass.get(t.classId);
    if (!existing || t.version > existing.version) newestPerClass.set(t.classId, t);
  }

  const occupiedFaculty = new Map<string, Set<string>>();
  const occupiedRooms = new Map<string, Set<string>>();
  const occupiedLabs = new Map<string, Set<string>>();
  for (const t of newestPerClass.values()) {
    for (const slot of t.slots) {
      const k = `${slot.dayOfWeek}|${slot.periodIndex}`;
      if (slot.facultyId) {
        const set = occupiedFaculty.get(slot.facultyId) ?? new Set<string>();
        set.add(k);
        occupiedFaculty.set(slot.facultyId, set);
      }
      if (slot.roomId) {
        const set = occupiedRooms.get(slot.roomId) ?? new Set<string>();
        set.add(k);
        occupiedRooms.set(slot.roomId, set);
      }
      if (slot.laboratoryId) {
        const set = occupiedLabs.get(slot.laboratoryId) ?? new Set<string>();
        set.add(k);
        occupiedLabs.set(slot.laboratoryId, set);
      }
    }
  }

  const roomOptions: RoomOption[] = rooms.map((r) => ({ id: r.id, code: r.code, name: r.name, capacity: r.capacity }));
  const labOptions: LabOption[] = laboratories.map((l) => ({
    id: l.id,
    code: l.code,
    name: l.name,
    capacity: l.capacity,
    roomId: l.rooms[0]?.id ?? null,
  }));

  const result = generateSchedule({
    classId: input.classId,
    config,
    subjects,
    unavailable,
    occupiedFaculty,
    occupiedRooms,
    occupiedLabs,
    classSize: klass._count.students,
    rooms: roomOptions,
    laboratories: labOptions,
    attempts: config.generationAttempts,
    seed: input.seed ?? Math.floor(Math.random() * 1_000_000),
  });

  const grid = buildDayGrid(config);
  const gridByIndex = new Map(grid.map((s) => [s.index, s]));

  const nextVersion =
    (await prisma.timetable.findFirst({
      where: { classId: input.classId, academicYearId: input.academicYearId },
      orderBy: { version: 'desc' },
      select: { version: true },
    }))?.version ?? 0;

  const version = nextVersion + 1;
  const status: TimetableStatus = input.publish ? 'PUBLISHED' : 'DRAFT';
  const name = `${klass.name} · Timetable v${version}`;

  const timetable = await prisma.$transaction(async (tx) => {
    // Previous versions of this class become ARCHIVED so exactly one is active.
    await tx.timetable.updateMany({
      where: { classId: input.classId, academicYearId: input.academicYearId, deletedAt: null, status: { not: 'ARCHIVED' } },
      data: { status: 'ARCHIVED' },
    });

    const created = await tx.timetable.create({
      data: {
        classId: input.classId,
        academicYearId: input.academicYearId,
        name,
        version,
        status,
        metrics: result.metrics as unknown as Prisma.InputJsonValue,
        conflicts: (result.unmet as unknown as Prisma.InputJsonValue) ?? undefined,
      },
    });

    const slotRows: Prisma.TimetableSlotCreateManyInput[] = [];
    // Breaks are stored too, so exports and print views are self-contained.
    for (const day of config.workingDays) {
      for (const slot of grid.filter((s) => s.kind === 'BREAK')) {
        slotRows.push({
          timetableId: created.id,
          classId: input.classId,
          dayOfWeek: day,
          periodIndex: slot.index,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isBreak: true,
          breakLabel: slot.label,
        });
      }
    }
    for (const placement of result.placements) {
      for (let offset = 0; offset < placement.length; offset += 1) {
        const slot = gridByIndex.get(placement.index + offset);
        if (!slot) continue;
        slotRows.push({
          timetableId: created.id,
          classId: input.classId,
          dayOfWeek: placement.day,
          periodIndex: slot.index,
          startTime: slot.startTime,
          endTime: slot.endTime,
          isBreak: false,
          subjectId: placement.subjectId,
          facultyId: placement.facultyId,
          roomId: placement.roomId,
          laboratoryId: placement.laboratoryId,
        });
      }
    }
    await tx.timetableSlot.createMany({ data: slotRows });
    return created;
  });

  const conflicts = await detectConflicts({ timetableId: timetable.id });
  await prisma.timetable.update({
    where: { id: timetable.id },
    data: { conflicts: conflicts as unknown as Prisma.InputJsonValue },
  });

  audit({
    action: 'timetable.generate',
    resourceType: 'Timetable',
    resourceId: timetable.id,
    description: `Generated ${name} — ${result.placements.length} sessions, ${result.unmet.length} unmet requirement(s)`,
    newValue: { version, status, metrics: result.metrics },
    userId: input.actorUserId,
  });

  if (status === 'PUBLISHED') {
    const students = await prisma.student.findMany({
      where: { classId: input.classId, deletedAt: null },
      select: { userId: true },
    });
    await notifyMany(students.map((s) => s.userId), {
      type: 'TIMETABLE_UPDATED',
      title: 'Your timetable has been published',
      message: `${klass.name} timetable (version ${version}) is now live.`,
      link: '/timetable',
    });
  }

  return {
    timetableId: timetable.id,
    version,
    status,
    placements: result.placements.length,
    warnings: result.warnings,
    conflicts,
    metrics: result.metrics as unknown as Record<string, unknown>,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Conflicts
// ─────────────────────────────────────────────────────────────────────────

export interface ConflictEntry {
  type: 'FACULTY' | 'ROOM' | 'LABORATORY' | 'WEEKLY_REQUIREMENT' | 'BREAK' | 'DISTRIBUTION' | 'UNASSIGNED';
  severity: 'ERROR' | 'WARNING';
  message: string;
  day?: DayOfWeek;
  periodIndex?: number;
  classIds?: string[];
}

export async function detectConflicts(scope: { timetableId?: string; academicYearId?: string }): Promise<ConflictEntry[]> {
  const { timetable: config } = await getSettings();
  const conflicts: ConflictEntry[] = [];

  const where: Prisma.TimetableSlotWhereInput = {
    isBreak: false,
    timetable: {
      deletedAt: null,
      status: { not: 'ARCHIVED' },
      ...(scope.timetableId ? { id: scope.timetableId } : {}),
      ...(scope.academicYearId ? { academicYearId: scope.academicYearId } : {}),
    },
  };

  const slots = await prisma.timetableSlot.findMany({
    where,
    include: {
      timetable: { select: { id: true, classId: true, version: true, status: true } },
      subject: { select: { id: true, name: true, code: true, weeklyPeriods: true } },
      faculty: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      room: { select: { id: true, code: true } },
      laboratory: { select: { id: true, name: true } },
    },
  });

  // Only the newest timetable per class participates.
  const newestVersion = new Map<string, number>();
  for (const slot of slots) {
    const current = newestVersion.get(slot.timetable.classId) ?? 0;
    if (slot.timetable.version > current) newestVersion.set(slot.timetable.classId, slot.timetable.version);
  }
  const active = slots.filter((s) => s.timetable.version === newestVersion.get(s.timetable.classId));

  const facultyMap = new Map<string, typeof active>();
  const roomMap = new Map<string, typeof active>();
  const labMap = new Map<string, typeof active>();
  for (const slot of active) {
    const k = `${slot.dayOfWeek}|${slot.periodIndex}`;
    if (slot.facultyId) {
      const list = facultyMap.get(`${slot.facultyId}|${k}`) ?? [];
      list.push(slot);
      facultyMap.set(`${slot.facultyId}|${k}`, list);
    }
    if (slot.roomId) {
      const list = roomMap.get(`${slot.roomId}|${k}`) ?? [];
      list.push(slot);
      roomMap.set(`${slot.roomId}|${k}`, list);
    }
    if (slot.laboratoryId) {
      const list = labMap.get(`${slot.laboratoryId}|${k}`) ?? [];
      list.push(slot);
      labMap.set(`${slot.laboratoryId}|${k}`, list);
    }
  }

  for (const [, list] of facultyMap) {
    if (list.length < 2) continue;
    const name = list[0].faculty ? `${list[0].faculty.user.firstName} ${list[0].faculty.user.lastName}` : 'Faculty';
    conflicts.push({
      type: 'FACULTY',
      severity: 'ERROR',
      message: `${name} is scheduled for ${list.length} classes at the same time (${DAY_LABEL[list[0].dayOfWeek]}, period ${list[0].periodIndex}).`,
      day: list[0].dayOfWeek,
      periodIndex: list[0].periodIndex,
      classIds: Array.from(new Set(list.map((l) => l.timetable.classId))),
    });
  }
  for (const [, list] of roomMap) {
    if (list.length < 2) continue;
    conflicts.push({
      type: 'ROOM',
      severity: 'ERROR',
      message: `Room ${list[0].room?.code} is double-booked (${DAY_LABEL[list[0].dayOfWeek]}, period ${list[0].periodIndex}).`,
      day: list[0].dayOfWeek,
      periodIndex: list[0].periodIndex,
      classIds: Array.from(new Set(list.map((l) => l.timetable.classId))),
    });
  }
  for (const [, list] of labMap) {
    if (list.length < 2) continue;
    conflicts.push({
      type: 'LABORATORY',
      severity: 'ERROR',
      message: `Laboratory ${list[0].laboratory?.name} is double-booked (${DAY_LABEL[list[0].dayOfWeek]}, period ${list[0].periodIndex}).`,
      day: list[0].dayOfWeek,
      periodIndex: list[0].periodIndex,
      classIds: Array.from(new Set(list.map((l) => l.timetable.classId))),
    });
  }

  // Weekly requirement per class+subject
  const perSubject = groupBy(active, (s) => `${s.timetable.classId}|${s.subjectId}`);
  for (const [, list] of perSubject) {
    const subject = list[0].subject;
    if (!subject) continue;
    if (list.length < subject.weeklyPeriods) {
      conflicts.push({
        type: 'WEEKLY_REQUIREMENT',
        severity: 'WARNING',
        message: `${subject.name} has ${list.length} of ${subject.weeklyPeriods} required weekly periods.`,
        classIds: [list[0].timetable.classId],
      });
    }
    // Distribution: more than the configured maximum on one day
    const perDay = groupBy(list, (s) => s.dayOfWeek);
    for (const [day, daySlots] of perDay) {
      if (daySlots.length > config.maxSameSubjectPerDay) {
        conflicts.push({
          type: 'DISTRIBUTION',
          severity: 'WARNING',
          message: `${subject.name} appears ${daySlots.length} times on ${DAY_LABEL[day as DayOfWeek]} (limit ${config.maxSameSubjectPerDay}).`,
          day: day as DayOfWeek,
          classIds: [list[0].timetable.classId],
        });
      }
    }
  }

  // Break protection / working hours for manually edited slots
  for (const slot of active) {
    const brk = violatesBreak(config, slot.startTime, slot.endTime);
    if (brk) {
      conflicts.push({
        type: 'BREAK',
        severity: 'ERROR',
        message: `A class overlaps ${brk.label} (${brk.start}–${brk.end}) on ${DAY_LABEL[slot.dayOfWeek]}.`,
        day: slot.dayOfWeek,
        periodIndex: slot.periodIndex,
        classIds: [slot.timetable.classId],
      });
    }
    if (outsideWorkingHours(config, slot.startTime, slot.endTime)) {
      conflicts.push({
        type: 'BREAK',
        severity: 'WARNING',
        message: `A class sits outside working hours (${config.workStart}–${config.workEnd}) on ${DAY_LABEL[slot.dayOfWeek]}.`,
        day: slot.dayOfWeek,
        periodIndex: slot.periodIndex,
        classIds: [slot.timetable.classId],
      });
    }
    if (!slot.facultyId && slot.subjectId) {
      conflicts.push({
        type: 'UNASSIGNED',
        severity: 'WARNING',
        message: `${slot.subject?.name ?? 'A session'} on ${DAY_LABEL[slot.dayOfWeek]} period ${slot.periodIndex} has no faculty assigned.`,
        day: slot.dayOfWeek,
        periodIndex: slot.periodIndex,
        classIds: [slot.timetable.classId],
      });
    }
  }

  return conflicts;
}

export async function conflictCount(academicYearId?: string) {
  const conflicts = await detectConflicts(academicYearId ? { academicYearId } : {});
  return {
    total: conflicts.length,
    errors: conflicts.filter((c) => c.severity === 'ERROR').length,
    warnings: conflicts.filter((c) => c.severity === 'WARNING').length,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Slot CRUD & lifecycle
// ─────────────────────────────────────────────────────────────────────────

export interface SlotInput {
  dayOfWeek: DayOfWeek;
  periodIndex: number;
  subjectId?: string | null;
  facultyId?: string | null;
  roomId?: string | null;
  laboratoryId?: string | null;
}

export async function updateSlot(timetableId: string, slotId: string, input: SlotInput, actorUserId: string) {
  const timetable = await prisma.timetable.findUnique({ where: { id: timetableId } });
  if (!timetable || timetable.deletedAt) throw notFound('That timetable does not exist.');

  const grid = buildDayGrid((await getSettings()).timetable);
  const slotDef = grid.find((s) => s.index === input.periodIndex);
  if (!slotDef) throw badRequest(`Period ${input.periodIndex} does not exist in the configured day grid.`);
  if (slotDef.kind === 'BREAK') throw badRequest(`${slotDef.label} is a configured break and cannot hold a class.`);

  const existing = await prisma.timetableSlot.findFirst({
    where: { id: slotId, timetableId },
  });

  const data = {
    dayOfWeek: input.dayOfWeek,
    periodIndex: input.periodIndex,
    startTime: slotDef.startTime,
    endTime: slotDef.endTime,
    isBreak: false,
    breakLabel: null,
    subjectId: input.subjectId ?? null,
    facultyId: input.facultyId ?? null,
    roomId: input.roomId ?? null,
    laboratoryId: input.laboratoryId ?? null,
  };

  const saved = existing
    ? await prisma.timetableSlot.update({ where: { id: slotId }, data })
    : await prisma.timetableSlot.create({ data: { ...data, timetableId, classId: timetable.classId } });

  audit({
    action: existing ? 'timetable.slot.update' : 'timetable.slot.create',
    resourceType: 'TimetableSlot',
    resourceId: saved.id,
    description: `${existing ? 'Updated' : 'Added'} ${DAY_LABEL[data.dayOfWeek]} period ${data.periodIndex}`,
    previousValue: existing ? { dayOfWeek: existing.dayOfWeek, periodIndex: existing.periodIndex } : undefined,
    newValue: data,
    userId: actorUserId,
  });

  return { slotId: saved.id, conflicts: await detectConflicts({ timetableId }) };
}

export async function deleteSlot(timetableId: string, slotId: string, actorUserId: string) {
  const slot = await prisma.timetableSlot.findFirst({ where: { id: slotId, timetableId } });
  if (!slot) throw notFound('That timetable slot does not exist.');
  if (slot.isBreak) throw badRequest('Break slots are generated from your settings and cannot be removed.');
  await prisma.timetableSlot.delete({ where: { id: slotId } });
  audit({
    action: 'timetable.slot.delete',
    resourceType: 'TimetableSlot',
    resourceId: slotId,
    description: `Removed ${DAY_LABEL[slot.dayOfWeek]} period ${slot.periodIndex}`,
    previousValue: { subjectId: slot.subjectId },
    userId: actorUserId,
  });
  return { deleted: true, conflicts: await detectConflicts({ timetableId }) };
}

export async function setTimetableStatus(timetableId: string, status: TimetableStatus, actorUserId: string) {
  const timetable = await prisma.timetable.findUnique({ where: { id: timetableId }, include: { class: true } });
  if (!timetable || timetable.deletedAt) throw notFound('That timetable does not exist.');

  await prisma.$transaction(async (tx) => {
    if (status !== 'ARCHIVED') {
      await tx.timetable.updateMany({
        where: {
          classId: timetable.classId,
          academicYearId: timetable.academicYearId,
          id: { not: timetableId },
          deletedAt: null,
          status: { not: 'ARCHIVED' },
        },
        data: { status: 'ARCHIVED' },
      });
    }
    await tx.timetable.update({ where: { id: timetableId }, data: { status } });
  });

  if (status === 'PUBLISHED') {
    const students = await prisma.student.findMany({
      where: { classId: timetable.classId, deletedAt: null },
      select: { userId: true },
    });
    await notifyMany(students.map((s) => s.userId), {
      type: 'TIMETABLE_UPDATED',
      title: 'Timetable published',
      message: `${timetable.class.name} timetable (v${timetable.version}) is now live.`,
      link: '/timetable',
    });
  }

  audit({
    action: 'timetable.status',
    resourceType: 'Timetable',
    resourceId: timetableId,
    description: `Timetable ${timetable.class.name} v${timetable.version} → ${status}`,
    previousValue: { status: timetable.status },
    newValue: { status },
    userId: actorUserId,
  });

  return { id: timetableId, status };
}

export async function deleteTimetable(timetableId: string, actorUserId: string) {
  const timetable = await prisma.timetable.findUnique({ where: { id: timetableId } });
  if (!timetable) throw notFound('That timetable does not exist.');
  await prisma.timetable.update({ where: { id: timetableId }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
  audit({
    action: 'timetable.delete',
    resourceType: 'Timetable',
    resourceId: timetableId,
    description: `Deleted timetable v${timetable.version}`,
    userId: actorUserId,
  });
  return { deleted: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────

export async function exportTimetable(timetableId: string, format: 'csv' | 'ics' = 'csv') {
  const { timetable: config } = await getSettings();
  const data = await getTimetable(timetableId);
  const grid = buildDayGrid(config);
  const days = config.workingDays;

  if (format === 'ics') {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CampusIQ//Timetable//EN', 'CALSCALE:GREGORIAN'];
    const monday = nextWeekday(new Date(), 1);
    for (const cell of data.cells) {
      if (cell.isBreak) continue;
      const dayOffset = days.indexOf(cell.day);
      if (dayOffset < 0) continue;
      const date = new Date(monday);
      date.setUTCDate(date.getUTCDate() + dayOffset);
      const dtstart = `${date.toISOString().slice(0, 10).replace(/-/g, '')}T${cell.startTime.replace(':', '')}00`;
      const dtend = `${date.toISOString().slice(0, 10).replace(/-/g, '')}T${cell.endTime.replace(':', '')}00`;
      lines.push(
        'BEGIN:VEVENT',
        `UID:${cell.slotId}@campusiq`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        `SUMMARY:${escapeIcs(`${cell.subjectCode ?? ''} ${cell.subjectName ?? 'Class'}`.trim())}`,
        `DESCRIPTION:${escapeIcs([cell.facultyName, cell.className].filter(Boolean).join(' · '))}`,
        cell.roomCode ? `LOCATION:${escapeIcs(cell.roomCode)}` : '',
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    return { filename: `${slug(data.timetable.name)}.ics`, mime: 'text/calendar', content: lines.filter(Boolean).join('\r\n') };
  }

  const header = ['Day', 'Period', 'Start', 'End', 'Subject', 'Code', 'Faculty', 'Room', 'Laboratory', 'Class'];
  const rows: string[][] = [header];
  for (const day of days) {
    for (const slot of grid) {
      const cell = data.cells.find((c) => c.day === day && c.index === slot.index);
      rows.push([
        DAY_SHORT[day],
        slot.kind === 'BREAK' ? '—' : String(slot.teachingIndex ?? ''),
        slot.startTime,
        slot.endTime,
        slot.kind === 'BREAK' ? slot.label : (cell?.subjectName ?? ''),
        cell?.subjectCode ?? '',
        cell?.facultyName ?? '',
        cell?.roomCode ?? '',
        cell?.laboratoryName ?? '',
        data.timetable.className,
      ]);
    }
  }
  return {
    filename: `${slug(data.timetable.name)}.csv`,
    mime: 'text/csv',
    content: rows.map((r) => r.map(csvCell).join(',')).join('\n'),
  };
}

const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const escapeIcs = (value: string) => value.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

function nextWeekday(from: Date, weekday: number) {
  const date = new Date(from);
  date.setUTCHours(0, 0, 0, 0);
  const diff = (weekday - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + (diff === 0 ? 7 : diff));
  return date;
}

/** "Today's classes" for a student or faculty member. */
export async function todaysSchedule(opts: { classId?: string; facultyId?: string }) {
  const { timetable: config } = await getSettings();
  const today = new Date();
  const names: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const day = names[today.getUTCDay()];
  if (!config.workingDays.includes(day)) {
    return { day, isWorkingDay: false, items: [] as TimetableCell[], upcoming: [] as TimetableCell[], current: null as TimetableCell | null };
  }

  const grid = await gridMap();
  const where: Prisma.TimetableSlotWhereInput = {
    dayOfWeek: day,
    timetable: { deletedAt: null, status: { not: 'ARCHIVED' } },
    ...(opts.classId ? { classId: opts.classId } : {}),
    ...(opts.facultyId ? { facultyId: opts.facultyId } : {}),
  };
  const slots = await prisma.timetableSlot.findMany({ where, include: slotInclude });
  const nowMinutes = today.getUTCHours() * 60 + today.getUTCMinutes();
  const items = latestSlotPerGrid(slots)
    .map((s) => toCell(s, grid))
    .filter((c) => !c.isBreak)
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

  return {
    day,
    isWorkingDay: true,
    items,
    upcoming: items.filter((i) => toMinutes(i.endTime) >= nowMinutes),
    current: items.find((i) => toMinutes(i.startTime) <= nowMinutes && toMinutes(i.endTime) > nowMinutes) ?? null,
  };
}

/** Faculty availability CRUD (used by the timetable editor). */
export async function listFacultyAvailability(facultyId: string) {
  const { timetable: config } = await getSettings();
  const grid = buildDayGrid(config).filter((s) => s.kind === 'PERIOD');
  const rows = await prisma.facultyAvailability.findMany({ where: { facultyId } });
  const map = new Map(rows.map((r) => [`${r.dayOfWeek}|${r.periodIndex}`, r]));

  return config.workingDays.flatMap((day) =>
    grid.map((slot) => ({
      day,
      dayLabel: DAY_LABEL[day],
      periodIndex: slot.index,
      teachingIndex: slot.teachingIndex,
      startTime: slot.startTime,
      endTime: slot.endTime,
      label: gridLabel(slot),
      isAvailable: map.get(`${day}|${slot.index}`)?.isAvailable ?? true,
      reason: map.get(`${day}|${slot.index}`)?.reason ?? null,
    })),
  );
}

export async function setFacultyAvailability(
  facultyId: string,
  entries: { dayOfWeek: DayOfWeek; periodIndex: number; isAvailable: boolean; reason?: string }[],
) {
  const result = await prisma.$transaction(
    entries.map((entry) =>
      prisma.facultyAvailability.upsert({
        where: {
          facultyId_dayOfWeek_periodIndex: {
            facultyId,
            dayOfWeek: entry.dayOfWeek,
            periodIndex: entry.periodIndex,
          },
        },
        create: {
          facultyId,
          dayOfWeek: entry.dayOfWeek,
          periodIndex: entry.periodIndex,
          isAvailable: entry.isAvailable,
          reason: entry.reason,
        },
        update: { isAvailable: entry.isAvailable, reason: entry.reason },
      }),
    ),
  );
  return { updated: result.length };
}

export { DAY_LABEL, DAY_SHORT, gridLabel };
