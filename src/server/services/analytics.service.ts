import { prisma } from '@/lib/db';
import { average, groupBy, percent, round } from '@/lib/utils';
import { DAY_ORDER, isoWeekday } from '@/lib/format';
import { attendanceAnalytics } from './attendance.service';
import { resultAnalytics } from './results.service';
import { conflictCount } from './timetable.service';

/**
 * Cross-module institution analytics for the admin Analytics screen.
 * Everything is derived from stored data — no sampling, no invented numbers.
 */
export interface AnalyticsFilter {
  departmentId?: string;
  classId?: string;
  from?: Date;
  to?: Date;
}

export async function institutionAnalytics(filter: AnalyticsFilter = {}) {
  const [attendance, results, conflicts, departments, students, iaMarks, timetableStats, userActivity] = await Promise.all([
    attendanceAnalytics(filter),
    resultAnalytics({ departmentId: filter.departmentId }),
    conflictCount(),
    prisma.department.findMany({ where: { deletedAt: null }, include: { _count: { select: { students: true, faculty: true, subjects: true, classes: true } } } }),
    prisma.student.findMany({
      where: { deletedAt: null, ...(filter.departmentId ? { departmentId: filter.departmentId } : {}) },
      select: { id: true, gender: true, semester: true, cgpa: true, academicStatus: true, classId: true, departmentId: true },
    }),
    prisma.iAMark.findMany({
      where: {
        iaExam: { deletedAt: null, ...(filter.classId ? { classId: filter.classId } : {}) },
        ...(filter.departmentId ? { iaExam: { class: { departmentId: filter.departmentId } } } : {}),
      },
      select: { marks: true, isAbsent: true, iaExam: { select: { maxMarks: true, examNumber: true, classId: true, subjectId: true } } },
      take: 40000,
    }),
    prisma.timetable.findMany({
      where: { ...(filter.classId ? { classId: filter.classId } : {}), ...(filter.departmentId ? { class: { departmentId: filter.departmentId } } : {}) },
      select: { id: true, status: true, classId: true },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      select: { role: true, lastLoginAt: true, status: true },
    }),
  ]);

  // ── Academics ──────────────────────────────────────────────────────────
  const byClass = groupBy(iaMarks, (m) => m.iaExam.classId);
  const classPerformanceRows = Array.from(byClass.entries()).map(([classId, rows]) => {
    const values = rows.filter((r) => !r.isAbsent).map((r) => (r.marks / r.iaExam.maxMarks) * 100);
    return { classId, average: values.length ? round(average(values), 1) : 0, entries: rows.length };
  });
  const classes = await prisma.class.findMany({
    where: { id: { in: classPerformanceRows.map((c) => c.classId) }, deletedAt: null },
    select: { id: true, name: true, department: { select: { code: true } } },
  });
  const className = new Map(classes.map((c) => [c.id, `${c.department.code} · ${c.name}`]));
  const classRanking = classPerformanceRows
    .map((c) => ({ ...c, className: className.get(c.classId) ?? c.classId }))
    .sort((a, b) => b.average - a.average);

  const bySubject = groupBy(iaMarks, (m) => m.iaExam.subjectId);
  const subjects = await prisma.subject.findMany({
    where: { id: { in: Array.from(bySubject.keys()) } },
    select: { id: true, code: true, name: true },
  });
  const subjectMeta = new Map(subjects.map((s) => [s.id, s]));
  const subjectPerformance = Array.from(bySubject.entries())
    .map(([subjectId, rows]) => {
      const values = rows.filter((r) => !r.isAbsent).map((r) => (r.marks / r.iaExam.maxMarks) * 100);
      const first = rows.filter((r) => r.iaExam.examNumber === 1 && !r.isAbsent).map((r) => (r.marks / r.iaExam.maxMarks) * 100);
      const highest = Math.max(0, ...rows.map((r) => r.iaExam.examNumber));
      const last = rows.filter((r) => r.iaExam.examNumber === highest && !r.isAbsent).map((r) => (r.marks / r.iaExam.maxMarks) * 100);
      const meta = subjectMeta.get(subjectId);
      return {
        subjectId,
        code: meta?.code ?? '',
        name: meta?.name ?? 'Subject',
        average: values.length ? round(average(values), 1) : 0,
        ia1Average: first.length ? round(average(first), 1) : 0,
        latestAverage: last.length ? round(average(last), 1) : 0,
        entries: rows.length,
      };
    })
    .sort((a, b) => a.average - b.average);

  const byExamNumber = groupBy(iaMarks, (m) => String(m.iaExam.examNumber));
  const examTrend = Array.from(byExamNumber.entries())
    .map(([num, rows]) => {
      const values = rows.filter((r) => !r.isAbsent).map((r) => (r.marks / r.iaExam.maxMarks) * 100);
      return { examNumber: Number(num), label: `IA ${num}`, average: values.length ? round(average(values), 1) : 0, entries: rows.length };
    })
    .sort((a, b) => a.examNumber - b.examNumber);

  const cgpaValues = students.map((s) => s.cgpa).filter((c): c is number => typeof c === 'number');

  // ── Demographics ───────────────────────────────────────────────────────
  const byDepartment = groupBy(students, (s) => s.departmentId);
  const departmentBreakdown = departments.map((d) => {
    const rows = byDepartment.get(d.id) ?? [];
    return {
      id: d.id,
      name: d.name,
      code: d.code,
      students: rows.length,
      faculty: d._count.faculty,
      subjects: d._count.subjects,
      classes: d._count.classes,
      averageCgpa: rows.some((r) => typeof r.cgpa === 'number')
        ? round(average(rows.map((r) => r.cgpa).filter((c): c is number => typeof c === 'number')), 2)
        : null,
      activeStudents: rows.filter((r) => r.academicStatus === 'ACTIVE').length,
    };
  });

  const byYear = groupBy(students, (s) => String(s.semester ?? 0));
  const semesterBreakdown = Array.from(byYear.entries())
    .map(([semester, rows]) => ({ semester: Number(semester), students: rows.length }))
    .sort((a, b) => a.semester - b.semester);

  const genderBreakdown = ['MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED'].map((g) => ({
    label: g === 'UNSPECIFIED' ? 'Not specified' : g.charAt(0) + g.slice(1).toLowerCase(),
    count: students.filter((s) => s.gender === g).length,
  }));

  // ── Engagement ─────────────────────────────────────────────────────────
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const active = userActivity.filter((u) => u.lastLoginAt && u.lastLoginAt > monthAgo).length;

  return {
    generatedAt: new Date().toISOString(),
    filter,
    attendance,
    academics: {
      averageScore: iaMarks.length ? round(average(iaMarks.filter((m) => !m.isAbsent).map((m) => (m.marks / m.iaExam.maxMarks) * 100)), 1) : 0,
      entries: iaMarks.length,
      absent: iaMarks.filter((m) => m.isAbsent).length,
      averageCgpa: cgpaValues.length ? round(average(cgpaValues), 2) : null,
      classRanking,
      subjectPerformance,
      examTrend,
    },
    results,
    timetable: {
      total: timetableStats.length,
      published: timetableStats.filter((t) => t.status === 'PUBLISHED').length,
      draft: timetableStats.filter((t) => t.status === 'DRAFT').length,
      archived: timetableStats.filter((t) => t.status === 'ARCHIVED').length,
      conflicts,
    },
    demographics: {
      students: students.length,
      activeStudents: students.filter((s) => s.academicStatus === 'ACTIVE').length,
      suspendedStudents: students.filter((s) => s.academicStatus === 'SUSPENDED').length,
      graduatedStudents: students.filter((s) => s.academicStatus === 'GRADUATED').length,
      departmentBreakdown,
      semesterBreakdown,
      genderBreakdown,
    },
    engagement: {
      totalUsers: userActivity.length,
      activeLast30Days: active,
      activityRate: percent(active, userActivity.length),
      admins: userActivity.filter((u) => u.role === 'ADMIN').length,
      faculty: userActivity.filter((u) => u.role === 'FACULTY').length,
      students: userActivity.filter((u) => u.role === 'STUDENT').length,
      suspendedUsers: userActivity.filter((u) => u.status === 'SUSPENDED').length,
    },
  };
}

/** Attendance heatmap by weekday and period, useful for the analytics screen. */
export async function attendanceHeatmap(filter: { departmentId?: string } = {}) {
  const rows = await prisma.attendanceRecord.findMany({
    where: {
      session: { deletedAt: null, ...(filter.departmentId ? { student: { departmentId: filter.departmentId } } : {}) },
    },
    select: { status: true, session: { select: { date: true, periodIndex: true } } },
    take: 60000,
  });

  const cells = new Map<string, { total: number; present: number }>();
  for (const row of rows) {
    // Attendance sessions store a date; the weekday is derived from it.
    const key = `${DAY_ORDER[isoWeekday(row.session.date) - 1]}:${row.session.periodIndex}`;
    const cell = cells.get(key) ?? { total: 0, present: 0 };
    cell.total += 1;
    if (row.status !== 'ABSENT') cell.present += 1;
    cells.set(key, cell);
  }

  const days = DAY_ORDER.slice(0, 6) as unknown as string[];
  const periods = Array.from(cells.keys())
    .map((k) => Number(k.split(':')[1]))
    .filter((n) => Number.isFinite(n));
  const periodRange = periods.length
    ? Array.from({ length: Math.max(...periods) + 1 }, (_, i) => i).filter((i) => i >= Math.min(...periods))
    : [];

  return {
    days,
    periods: periodRange,
    cells: days.flatMap((day) =>
      periodRange.map((period) => {
        const cell = cells.get(`${day}:${period}`);
        return {
          day,
          period,
          total: cell?.total ?? 0,
          percentage: cell && cell.total ? percent(cell.present, cell.total) : null,
        };
      }),
    ),
  };
}
