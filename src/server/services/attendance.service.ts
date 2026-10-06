import type { AttendanceStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { average, clamp, groupBy, percent, round } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { notFound, badRequest, forbidden } from '@/server/api/errors';
import { attendanceBand, classesNeededToReach, getSettings } from './settings.service';
import { notifyMany } from './notification.service';
import { audit } from './audit.service';
import type { AttendanceBand, AttendanceBandKey, AttendanceThresholds } from '@/types/settings';

export interface AttendanceTotals {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  percentage: number;
  band: AttendanceBand;
  bandKey: AttendanceBandKey;
}

export function countStatus(status: AttendanceStatus, thresholds: AttendanceThresholds): number {
  if (status === 'PRESENT') return 1;
  if (status === 'LATE') return thresholds.countLateAsPresent ? 1 : 0;
  if (status === 'EXCUSED') return 1;
  return 0;
}

export function computeTotals(
  statuses: AttendanceStatus[],
  thresholds: AttendanceThresholds,
): AttendanceTotals {
  const total = statuses.length;
  const present = statuses.filter((s) => s === 'PRESENT').length;
  const absent = statuses.filter((s) => s === 'ABSENT').length;
  const late = statuses.filter((s) => s === 'LATE').length;
  const excused = statuses.filter((s) => s === 'EXCUSED').length;
  const credited = statuses.reduce((acc, s) => acc + countStatus(s, thresholds), 0);
  const pct = total === 0 ? 0 : round((credited / total) * 100, 1);
  const band = attendanceBand(total === 0 ? null : pct, thresholds);
  return { total, present, absent, late, excused, percentage: pct, band, bandKey: band.key };
}

export interface SubjectAttendance extends AttendanceTotals {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  classesNeeded: number;
  lastClass?: string;
}

export interface MonthlyAttendance {
  key: string; // YYYY-MM
  label: string;
  total: number;
  present: number;
  percentage: number;
}

export interface StudentAttendanceSummary {
  overall: AttendanceTotals;
  subjects: SubjectAttendance[];
  monthly: MonthlyAttendance[];
  delta: number | null;
  atRiskSubjects: SubjectAttendance[];
  classesNeededForSafe: number;
  thresholds: AttendanceThresholds;
  lastUpdated?: string;
}

const monthKey = (date: Date) => date.toISOString().slice(0, 7);

/** Full attendance picture for one student, computed from stored records. */
export async function studentAttendanceSummary(
  studentId: string,
  options: { from?: Date; to?: Date; subjectId?: string } = {},
): Promise<StudentAttendanceSummary> {
  const { attendance: thresholds } = await getSettings();

  const records = await prisma.attendanceRecord.findMany({
    where: {
      studentId,
      session: {
        deletedAt: null,
        status: 'COMPLETED',
        ...(options.subjectId ? { subjectId: options.subjectId } : {}),
        ...(options.from || options.to
          ? { date: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) } }
          : {}),
      },
    },
    select: {
      status: true,
      session: {
        select: {
          date: true,
          subjectId: true,
          subject: { select: { id: true, code: true, name: true } },
        },
      },
    },
    orderBy: { session: { date: 'desc' } },
  });

  const overall = computeTotals(records.map((r) => r.status), thresholds);

  const bySubject = groupBy(records, (r) => r.session.subjectId);
  const subjects: SubjectAttendance[] = Array.from(bySubject.entries()).map(([subjectId, rows]) => {
    const totals = computeTotals(rows.map((r) => r.status), thresholds);
    const credited = rows.reduce((acc, r) => acc + countStatus(r.status, thresholds), 0);
    return {
      subjectId,
      subjectCode: rows[0]?.session.subject.code ?? '',
      subjectName: rows[0]?.session.subject.name ?? 'Subject',
      ...totals,
      classesNeeded: classesNeededToReach(totals.percentage, thresholds.safe, credited, totals.total),
      lastClass: rows[0] ? formatDate(rows[0].session.date) : undefined,
    };
  });
  subjects.sort((a, b) => a.percentage - b.percentage);

  const byMonth = groupBy(records, (r) => monthKey(r.session.date));
  const monthly: MonthlyAttendance[] = Array.from(byMonth.entries())
    .map(([key, rows]) => {
      const totals = computeTotals(rows.map((r) => r.status), thresholds);
      return { key, label: key, total: totals.total, present: totals.present, percentage: totals.percentage };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  // Month-over-month change
  let delta: number | null = null;
  if (monthly.length >= 2) {
    delta = round(monthly[monthly.length - 1].percentage - monthly[monthly.length - 2].percentage, 1);
  }

  const atRiskSubjects = subjects.filter((s) => s.percentage < thresholds.safe);
  const classesNeededForSafe = atRiskSubjects.reduce((max, s) => Math.max(max, s.classesNeeded), 0);

  return {
    overall,
    subjects,
    monthly,
    delta,
    atRiskSubjects,
    classesNeededForSafe,
    thresholds,
    lastUpdated: records[0] ? records[0].session.date.toISOString() : undefined,
  };
}

export interface AttendanceHistoryItem {
  id: string;
  date: string;
  status: AttendanceStatus;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  periodIndex: number;
  sessionId: string;
  remarks?: string | null;
  faculty?: string | null;
}

export async function studentAttendanceHistory(
  studentId: string,
  options: { subjectId?: string; from?: Date; to?: Date; status?: AttendanceStatus; page?: number; pageSize?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = clamp(options.pageSize ?? 20, 1, 100);

  const where: Prisma.AttendanceRecordWhereInput = {
    studentId,
    ...(options.status ? { status: options.status } : {}),
    session: {
      deletedAt: null,
      ...(options.subjectId ? { subjectId: options.subjectId } : {}),
      ...(options.from || options.to
        ? { date: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) } }
        : {}),
    },
  };

  const [total, rows] = await Promise.all([
    prisma.attendanceRecord.count({ where }),
    prisma.attendanceRecord.findMany({
      where,
      orderBy: [{ session: { date: 'desc' } }, { session: { periodIndex: 'asc' } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        remarks: true,
        sessionId: true,
        session: {
          select: {
            date: true,
            periodIndex: true,
            subject: { select: { id: true, name: true, code: true } },
            faculty: { select: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    }),
  ]);

  const items: AttendanceHistoryItem[] = rows.map((r) => ({
    id: r.id,
    date: r.session.date.toISOString(),
    status: r.status,
    subjectId: r.session.subject.id,
    subjectName: r.session.subject.name,
    subjectCode: r.session.subject.code,
    periodIndex: r.session.periodIndex,
    sessionId: r.sessionId,
    remarks: r.remarks,
    faculty: r.session.faculty ? `${r.session.faculty.user.firstName} ${r.session.faculty.user.lastName}` : null,
  }));

  return { items, meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}

// ─────────────────────────────────────────────────────────────────────────
// Faculty: marking
// ─────────────────────────────────────────────────────────────────────────

export interface MarkAttendanceInput {
  facultyId: string;
  actorUserId: string;
  subjectId: string;
  classId: string;
  date: Date;
  periodIndex: number;
  startTime?: string;
  endTime?: string;
  topic?: string;
  notes?: string;
  status?: 'COMPLETED' | 'CANCELLED' | 'SCHEDULED';
  records: { studentId: string; status: AttendanceStatus; remarks?: string }[];
}

/**
 * Create or update one attendance session.
 * Students already marked keep their record; anything new is inserted and
 * anything removed is deleted, so the roster stays authoritative.
 */
export async function saveAttendanceSession(input: MarkAttendanceInput) {
  if (input.records.length === 0) throw badRequest('Select at least one student to save attendance.');

  const [subject, klass] = await Promise.all([
    prisma.subject.findUnique({ where: { id: input.subjectId }, include: { department: true } }),
    prisma.class.findUnique({ where: { id: input.classId } }),
  ]);
  if (!subject || subject.deletedAt) throw notFound('That subject no longer exists.');
  if (!klass || klass.deletedAt) throw notFound('That class no longer exists.');

  // Authorisation: only faculty assigned to this subject/class (or an admin).
  const assignment = await prisma.facultySubject.findFirst({
    where: { facultyId: input.facultyId, subjectId: input.subjectId },
  });
  const handlesClass = await prisma.classSubject.findFirst({
    where: { classId: input.classId, subjectId: input.subjectId },
  });
  if (!assignment || !handlesClass) {
    throw forbidden('You are not assigned to teach this subject for that class.');
  }

  const enrolled = await prisma.student.findMany({
    where: { classId: input.classId, deletedAt: null, user: { status: 'ACTIVE' } },
    select: { id: true, userId: true, registerNumber: true },
  });
  const enrolledIds = new Set(enrolled.map((s) => s.id));
  const invalid = input.records.filter((r) => !enrolledIds.has(r.studentId));
  if (invalid.length > 0) {
    throw badRequest(`${invalid.length} selected student(s) are not on this class roster.`);
  }

  const { attendance: thresholds } = await getSettings();

  const counts = input.records.reduce(
    (acc, r) => {
      acc.total += 1;
      if (r.status === 'ABSENT') acc.absent += 1;
      else acc.present += 1;
      return acc;
    },
    { total: 0, present: 0, absent: 0 },
  );

  const session = await prisma.$transaction(async (tx) => {
    const upserted = await tx.attendanceSession.upsert({
      where: {
        subjectId_classId_date_periodIndex: {
          subjectId: input.subjectId,
          classId: input.classId,
          date: input.date,
          periodIndex: input.periodIndex,
        },
      },
      create: {
        subjectId: input.subjectId,
        classId: input.classId,
        facultyId: input.facultyId,
        date: input.date,
        periodIndex: input.periodIndex,
        startTime: input.startTime,
        endTime: input.endTime,
        topic: input.topic,
        notes: input.notes,
        status: input.status ?? 'COMPLETED',
        totalStudents: counts.total,
        presentCount: counts.present,
        absentCount: counts.absent,
      },
      update: {
        facultyId: input.facultyId,
        startTime: input.startTime,
        endTime: input.endTime,
        topic: input.topic,
        notes: input.notes,
        status: input.status ?? 'COMPLETED',
        totalStudents: counts.total,
        presentCount: counts.present,
        absentCount: counts.absent,
        deletedAt: null,
      },
      include: { subject: true, class: true },
    });

    await tx.attendanceRecord.deleteMany({
      where: { sessionId: upserted.id, studentId: { notIn: input.records.map((r) => r.studentId) } },
    });

    for (const record of input.records) {
      await tx.attendanceRecord.upsert({
        where: { sessionId_studentId: { sessionId: upserted.id, studentId: record.studentId } },
        create: { sessionId: upserted.id, studentId: record.studentId, status: record.status, remarks: record.remarks },
        update: { status: record.status, remarks: record.remarks, markedAt: new Date() },
      });
    }

    return upserted;
  });

  audit({
    action: 'attendance.save',
    resourceType: 'AttendanceSession',
    resourceId: session.id,
    description: `Attendance saved for ${subject.name} · ${klass.name} on ${formatDate(input.date)} (period ${input.periodIndex}) — ${counts.present}/${counts.total} present`,
    newValue: { counts, periodIndex: input.periodIndex },
    userId: input.actorUserId,
  });

  // Alert students who just slipped below the safe threshold.
  const absentees = input.records.filter((r) => r.status === 'ABSENT').map((r) => r.studentId);
  if (absentees.length > 0) {
    const summaries = await Promise.all(
      absentees.slice(0, 40).map(async (studentId) => {
        const rows = await prisma.attendanceRecord.findMany({
          where: { studentId, session: { subjectId: input.subjectId, deletedAt: null } },
          select: { status: true, student: { select: { userId: true } } },
        });
        const totals = computeTotals(rows.map((r) => r.status), thresholds);
        return { userId: rows[0]?.student.userId, percentage: totals.percentage };
      }),
    );
    const toAlert = summaries
      .filter((s) => s.userId && s.percentage < thresholds.safe && s.percentage > 0)
      .map((s) => s.userId as string);
    if (toAlert.length > 0) {
      await notifyMany(Array.from(new Set(toAlert)), {
        type: 'ATTENDANCE_ALERT',
        title: `${subject.name} attendance below ${thresholds.safe}%`,
        message: `Your ${subject.name} attendance is now ${formatPercentSafe(
          summaries.find((s) => s.percentage < thresholds.safe)?.percentage ?? 0,
        )}. Attend your next classes to get back into the safe range.`,
        link: '/attendance',
      });
    }
  }

  return { sessionId: session.id, ...counts };
}

const formatPercentSafe = (v: number) => `${round(v, 1)}%`;

export interface RosterStudent {
  id: string;
  registerNumber: string;
  rollNumber: string | null;
  firstName: string;
  lastName: string;
  subjectPercentage: number;
  overallPercentage: number;
  existingStatus?: AttendanceStatus;
}

/** Roster for the faculty marking screen, with per-student context. */
export async function markingRoster(input: {
  classId: string;
  subjectId: string;
  date?: Date;
  periodIndex?: number;
  sessionId?: string;
}) {
  const { attendance: thresholds } = await getSettings();

  const students = await prisma.student.findMany({
    where: { classId: input.classId, deletedAt: null },
    include: { user: { select: { firstName: true, lastName: true, status: true } } },
    orderBy: [{ registerNumber: 'asc' }],
  });

  const [existing, subjectRecords] = await Promise.all([
    input.sessionId
      ? prisma.attendanceRecord.findMany({ where: { sessionId: input.sessionId } })
      : input.date && input.periodIndex !== undefined
        ? prisma.attendanceRecord.findMany({
            where: {
              session: {
                classId: input.classId,
                subjectId: input.subjectId,
                date: input.date,
                periodIndex: input.periodIndex,
              },
            },
          })
        : Promise.resolve([]),
    prisma.attendanceRecord.findMany({
      where: { studentId: { in: students.map((s) => s.id) }, session: { subjectId: input.subjectId, deletedAt: null } },
      select: { status: true, studentId: true },
    }),
  ]);

  const existingByStudent = new Map(existing.map((r) => [r.studentId, r.status]));
  const subjectByStudent = groupBy(subjectRecords, (r) => r.studentId);

  const overallRows = await prisma.attendanceRecord.findMany({
    where: { studentId: { in: students.map((s) => s.id) }, session: { deletedAt: null } },
    select: { status: true, studentId: true },
  });
  const overallByStudent = groupBy(overallRows, (r) => r.studentId);

  const roster: RosterStudent[] = students.map((s) => {
    const subjectTotals = computeTotals((subjectByStudent.get(s.id) ?? []).map((r) => r.status), thresholds);
    const overallTotals = computeTotals((overallByStudent.get(s.id) ?? []).map((r) => r.status), thresholds);
    return {
      id: s.id,
      registerNumber: s.registerNumber,
      rollNumber: s.rollNumber,
      firstName: s.user.firstName,
      lastName: s.user.lastName,
      subjectPercentage: subjectTotals.percentage,
      overallPercentage: overallTotals.percentage,
      existingStatus: existingByStudent.get(s.id),
    };
  });

  const session =
    input.sessionId
      ? await prisma.attendanceSession.findUnique({ where: { id: input.sessionId } })
      : input.date && input.periodIndex !== undefined
        ? await prisma.attendanceSession.findUnique({
            where: {
              subjectId_classId_date_periodIndex: {
                subjectId: input.subjectId,
                classId: input.classId,
                date: input.date,
                periodIndex: input.periodIndex,
              },
            },
          })
        : null;

  return { roster, session, thresholds };
}

export async function listAttendanceSessions(filter: {
  classId?: string;
  subjectId?: string;
  facultyId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = clamp(filter.pageSize ?? 20, 1, 100);
  const where: Prisma.AttendanceSessionWhereInput = {
    deletedAt: null,
    ...(filter.classId ? { classId: filter.classId } : {}),
    ...(filter.subjectId ? { subjectId: filter.subjectId } : {}),
    ...(filter.facultyId ? { facultyId: filter.facultyId } : {}),
    ...(filter.from || filter.to
      ? { date: { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) } }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.attendanceSession.count({ where }),
    prisma.attendanceSession.findMany({
      where,
      orderBy: [{ date: 'desc' }, { periodIndex: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        subject: { select: { id: true, code: true, name: true } },
        class: { select: { id: true, name: true, section: true, yearOfStudy: true } },
        faculty: { select: { user: { select: { firstName: true, lastName: true } } } },
      },
    }),
  ]);

  return {
    items: rows.map((s) => ({
      id: s.id,
      date: s.date.toISOString(),
      periodIndex: s.periodIndex,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      topic: s.topic,
      totalStudents: s.totalStudents,
      presentCount: s.presentCount,
      absentCount: s.absentCount,
      percentage: s.totalStudents ? percent(s.presentCount, s.totalStudents) : 0,
      subject: s.subject,
      class: s.class,
      facultyName: s.faculty ? `${s.faculty.user.firstName} ${s.faculty.user.lastName}` : null,
    })),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function deleteAttendanceSession(sessionId: string, actorUserId: string) {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: { subject: true, class: true },
  });
  if (!session) throw notFound('That attendance session does not exist.');

  await prisma.attendanceSession.update({
    where: { id: sessionId },
    data: { deletedAt: new Date(), status: 'CANCELLED' },
  });

  audit({
    action: 'attendance.delete',
    resourceType: 'AttendanceSession',
    resourceId: sessionId,
    description: `Attendance deleted for ${session.subject.name} · ${session.class.name} on ${formatDate(session.date)}`,
    previousValue: { presentCount: session.presentCount, totalStudents: session.totalStudents },
    userId: actorUserId,
  });
  return { deleted: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────────────────────────────────

export interface AtRiskStudent {
  studentId: string;
  userId: string;
  registerNumber: string;
  name: string;
  percentage: number;
  bandKey: AttendanceBandKey;
  absentCount: number;
  worstSubject?: string;
}

export async function attendanceAnalytics(filter: { classId?: string; subjectId?: string; departmentId?: string }) {
  const { attendance: thresholds } = await getSettings();

  const where: Prisma.AttendanceRecordWhereInput = {
    session: {
      deletedAt: null,
      ...(filter.classId ? { classId: filter.classId } : {}),
      ...(filter.subjectId ? { subjectId: filter.subjectId } : {}),
      ...(filter.departmentId
        ? { class: { departmentId: filter.departmentId } }
        : {}),
    },
  };

  const rows = await prisma.attendanceRecord.findMany({
    where,
    select: {
      status: true,
      studentId: true,
      session: {
        select: {
          date: true,
          subjectId: true,
          subject: { select: { name: true, code: true } },
          classId: true,
        },
      },
      student: {
        select: {
          id: true,
          registerNumber: true,
          userId: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (rows.length === 0) {
    return {
      classAverage: 0,
      distribution: [],
      monthly: [],
      subjectComparison: [],
      studentComparison: [],
      atRisk: [] as AtRiskStudent[],
      totals: computeTotals([], thresholds),
      thresholds,
      recordCount: 0,
    };
  }

  const totals = computeTotals(rows.map((r) => r.status), thresholds);

  const byStudent = groupBy(rows, (r) => r.studentId);
  const studentStats = Array.from(byStudent.entries()).map(([studentId, studentRows]) => {
    const t = computeTotals(studentRows.map((r) => r.status), thresholds);
    const perSubject = groupBy(studentRows, (r) => r.session.subjectId);
    let worst: { name: string; pct: number } | undefined;
    for (const [, list] of perSubject) {
      const st = computeTotals(list.map((r) => r.status), thresholds);
      if (!worst || st.percentage < worst.pct) worst = { name: list[0].session.subject.name, pct: st.percentage };
    }
    return {
      studentId,
      userId: studentRows[0].student.userId,
      registerNumber: studentRows[0].student.registerNumber,
      name: `${studentRows[0].student.user.firstName} ${studentRows[0].student.user.lastName}`,
      percentage: t.percentage,
      bandKey: t.bandKey,
      absentCount: t.absent,
      worstSubject: worst ? `${worst.name} (${round(worst.pct, 0)}%)` : undefined,
    };
  });

  const bySubject = groupBy(rows, (r) => r.session.subjectId);
  const subjectComparison = Array.from(bySubject.entries())
    .map(([subjectId, list]) => {
      const t = computeTotals(list.map((r) => r.status), thresholds);
      return {
        subjectId,
        subjectCode: list[0].session.subject.code,
        subjectName: list[0].session.subject.name,
        percentage: t.percentage,
        total: t.total,
        absent: t.absent,
        bandKey: t.bandKey,
      };
    })
    .sort((a, b) => b.percentage - a.percentage);

  const byMonth = groupBy(rows, (r) => monthKey(r.session.date));
  const monthly = Array.from(byMonth.entries())
    .map(([key, list]) => {
      const t = computeTotals(list.map((r) => r.status), thresholds);
      return { key, label: key, percentage: t.percentage, total: t.total };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  const buckets: { label: string; min: number; max: number; count: number }[] = [
    { label: '90–100%', min: 90, max: 101, count: 0 },
    { label: `${thresholds.safe}–89%`, min: thresholds.safe, max: 90, count: 0 },
    { label: `${thresholds.fine}–${thresholds.safe - 1}%`, min: thresholds.fine, max: thresholds.safe, count: 0 },
    { label: `${thresholds.debar}–${thresholds.fine - 1}%`, min: thresholds.debar, max: thresholds.fine, count: 0 },
    { label: `Below ${thresholds.debar}%`, min: -1, max: thresholds.debar, count: 0 },
  ];
  for (const s of studentStats) {
    const bucket = buckets.find((b) => s.percentage >= b.min && s.percentage < b.max);
    if (bucket) bucket.count += 1;
  }

  return {
    classAverage: round(average(studentStats.map((s) => s.percentage)), 1),
    distribution: buckets,
    monthly,
    subjectComparison,
    studentComparison: studentStats.slice().sort((a, b) => b.percentage - a.percentage),
    atRisk: studentStats
      .filter((s) => s.percentage < thresholds.safe)
      .sort((a, b) => a.percentage - b.percentage) as AtRiskStudent[],
    totals,
    thresholds,
    recordCount: rows.length,
  };
}

/** Classes a faculty member has already taken, plus what is still pending today. */
export async function facultyAttendanceQueue(facultyId: string) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [assignments, taken] = await Promise.all([
    prisma.facultySubject.findMany({
      where: { facultyId },
      include: {
        subject: { select: { id: true, code: true, name: true, subjectType: true } },
      },
    }),
    prisma.attendanceSession.findMany({
      where: { facultyId, deletedAt: null, date: { gte: today } },
      select: { id: true, subjectId: true, classId: true, periodIndex: true, presentCount: true, totalStudents: true },
    }),
  ]);

  const classes = await prisma.classSubject.findMany({
    where: { subjectId: { in: assignments.map((a) => a.subjectId) } },
    include: { class: { select: { id: true, name: true, section: true, yearOfStudy: true } } },
  });

  const takenKeys = new Set(taken.map((t) => `${t.subjectId}|${t.classId}|${t.periodIndex}`));

  const pending = classes
    .filter((cs) => assignments.some((a) => a.subjectId === cs.subjectId))
    .map((cs) => ({
      classId: cs.classId,
      className: cs.class.name,
      subjectId: cs.subjectId,
      subjectName: assignments.find((a) => a.subjectId === cs.subjectId)?.subject.name ?? '',
      subjectCode: assignments.find((a) => a.subjectId === cs.subjectId)?.subject.code ?? '',
      takenToday: taken.some((t) => t.classId === cs.classId && t.subjectId === cs.subjectId),
    }));

  const recent = await prisma.attendanceSession.findMany({
    where: { facultyId, deletedAt: null },
    orderBy: { date: 'desc' },
    take: 8,
    include: {
      subject: { select: { name: true, code: true } },
      class: { select: { name: true } },
    },
  });

  return {
    pending: pending.slice(0, 12),
    takenKeys: Array.from(takenKeys),
    recent: recent.map((r) => ({
      id: r.id,
      date: r.date.toISOString(),
      periodIndex: r.periodIndex,
      subjectName: r.subject.name,
      subjectCode: r.subject.code,
      className: r.class.name,
      presentCount: r.presentCount,
      totalStudents: r.totalStudents,
      percentage: r.totalStudents ? percent(r.presentCount, r.totalStudents) : 0,
    })),
    todayTaken: taken.length,
  };
}
