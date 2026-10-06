import type { Role } from '@prisma/client';

import { prisma } from '@/lib/db';
import { average, percent, round } from '@/lib/utils';
import { greeting } from '@/lib/format';
import type { AuthenticatedUser } from '@/server/auth/session';
import { computeTotals, studentAttendanceSummary } from './attendance.service';
import { studentPerformance, pendingAssessments } from './academics.service';
import { resultAnalytics, studentResultHistory } from './results.service';
import { studentSkillGaps } from './career.service';
import { conflictCount, todaysSchedule } from './timetable.service';
import { getSettings } from './settings.service';

/**
 * Role-aware dashboards. Every dashboard answers three questions up front:
 * what is this, what can I do here, and what needs my attention.
 */

export interface AttentionItem {
  id: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  href: string;
  metric?: string;
}

export interface DashboardAction {
  label: string;
  href: string;
  description: string;
  primary?: boolean;
}

const notificationView = (rows: { id: string; type: string; title: string; message: string; link: string | null; isRead: boolean; createdAt: Date }[]) =>
  rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  }));

// ─────────────────────────────────────────────────────────────────────────
// Student
// ─────────────────────────────────────────────────────────────────────────

export async function studentDashboard(user: AuthenticatedUser, studentId: string) {
  const { attendance: thresholds } = await getSettings();

  const [attendance, academics, history, today, gaps, notifications, upcomingExams, profile] = await Promise.all([
    studentAttendanceSummary(studentId),
    studentPerformance(studentId),
    studentResultHistory(studentId),
    todaysSchedule({ classId: user.classId ?? undefined }),
    studentSkillGaps(studentId),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 4 }),
    user.classId
      ? prisma.iAExam.findMany({
          where: { classId: user.classId, deletedAt: null, examDate: { gte: new Date(new Date().setUTCHours(0, 0, 0, 0)) } },
          orderBy: { examDate: 'asc' },
          take: 3,
          include: { subject: { select: { code: true, name: true } } },
        })
      : Promise.resolve([]),
    prisma.student.findUnique({
      where: { id: studentId },
      select: { registerNumber: true, semester: true, cgpa: true, class: { select: { name: true } } },
    }),
  ]);

  const attention: AttentionItem[] = attendance.atRiskSubjects.slice(0, 4).map((s) => ({
    id: s.subjectId,
    severity: s.percentage < thresholds.fine ? 'high' : 'medium',
    title: s.subjectName,
    detail:
      s.percentage < thresholds.debar
        ? `Below the ${thresholds.debar}% debar line — speak to your faculty advisor.`
        : s.classesNeeded > 0
          ? `${s.classesNeeded} more class${s.classesNeeded === 1 ? '' : 'es'} needed to reach the ${thresholds.safe}% safe range.`
          : `Attendance is slipping (safe range is ${thresholds.safe}%).`,
    href: '/attendance',
    metric: `${round(s.percentage, 0)}%`,
  }));

  if (history.openArrears.length > 0) {
    attention.push({
      id: 'arrears',
      severity: 'high',
      title: `${history.openArrears.length} open arrear${history.openArrears.length === 1 ? '' : 's'}`,
      detail: history.openArrears.map((a) => a.subjectName).slice(0, 3).join(', '),
      href: '/results',
      metric: String(history.openArrears.length),
    });
  }

  if (academics.overall > 0 && academics.overall < 40) {
    attention.push({
      id: 'academics',
      severity: 'medium',
      title: 'Internal assessment average is low',
      detail: `Your IA average is ${round(academics.overall, 0)}%. Review the subject-wise marks with your faculty.`,
      href: '/academics',
      metric: `${round(academics.overall, 0)}%`,
    });
  }

  if (gaps.open > 0) {
    attention.push({
      id: 'career',
      severity: 'low',
      title: `${gaps.open} skill gap${gaps.open === 1 ? '' : 's'} from your resume matches`,
      detail: gaps.items.slice(0, 3).map((i) => i.skillName).join(', '),
      href: '/career',
      metric: gaps.bestScore !== null ? `Best ${gaps.bestScore}%` : undefined,
    });
  }

  return {
    role: 'STUDENT' as Role,
    greeting: greeting(),
    firstName: user.firstName,
    subtitle: profile?.class?.name ? `${profile.class.name} · Semester ${profile.semester}` : 'Student',
    attention: attention.slice(0, 5),
    actions: [
      { label: 'View attendance', href: '/attendance', description: 'Subject-wise breakdown and monthly trend', primary: true },
      { label: today.items.length ? 'Open today’s timetable' : 'Open timetable', href: '/timetable', description: 'Weekly schedule, rooms and labs' },
      { label: 'Check results', href: '/results', description: 'University results and arrear timeline' },
      { label: 'Analyse a resume', href: '/career', description: 'Match your resume to a job description' },
    ],
    stats: {
      attendancePercentage: attendance.overall.percentage,
      attendanceBand: attendance.overall.band,
      attendanceDelta: attendance.delta,
      classesAttended: attendance.overall.present,
      classesMissed: attendance.overall.absent,
      totalClasses: attendance.overall.total,
      iaAverage: academics.overall,
      classRank: academics.rank,
      classSize: academics.classSize,
      cgpa: history.cgpa ?? profile?.cgpa ?? null,
      openArrears: history.openArrears.length,
      clearedArrears: history.clearedArrears.length,
      todayClasses: today.items.length,
      subjects: attendance.subjects.length,
      skillGaps: gaps.open,
      bestMatchScore: gaps.bestScore,
    },
    today: {
      day: today.day,
      isWorkingDay: today.isWorkingDay,
      items: today.items.map((i) => ({
        slotId: i.slotId,
        startTime: i.startTime,
        endTime: i.endTime,
        subjectName: i.subjectName,
        subjectCode: i.subjectCode,
        facultyName: i.facultyName,
        roomCode: i.roomCode,
        laboratoryName: i.laboratoryName,
      })),
      current: today.current
        ? { subjectName: today.current.subjectName, startTime: today.current.startTime, endTime: today.current.endTime }
        : null,
    },
    subjectAttendance: attendance.subjects.slice(0, 6),
    monthlyAttendance: attendance.monthly.slice(-6),
    subjectPerformance: academics.subjects.slice(0, 6),
    performanceTrend: academics.trend,
    upcomingExams: upcomingExams.map((e) => ({
      id: e.id,
      name: e.name,
      subjectName: e.subject.name,
      subjectCode: e.subject.code,
      examDate: e.examDate.toISOString(),
      maxMarks: e.maxMarks,
    })),
    notifications: notificationView(notifications),
    thresholds,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Faculty
// ─────────────────────────────────────────────────────────────────────────

export async function facultyDashboard(user: AuthenticatedUser, facultyId: string) {
  const { attendance: thresholds } = await getSettings();

  const [assignments, pending, today, notifications] = await Promise.all([
    prisma.facultySubject.findMany({
      where: { facultyId },
      include: { subject: { select: { id: true, code: true, name: true } } },
    }),
    pendingAssessments(facultyId),
    todaysSchedule({ facultyId }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 4 }),
  ]);

  const subjectIds = assignments.map((a) => a.subjectId);

  const [classSubjects, sessions] = await Promise.all([
    prisma.classSubject.findMany({
      where: { subjectId: { in: subjectIds } },
      include: {
        class: { select: { id: true, name: true, _count: { select: { students: true } } } },
        subject: { select: { id: true, name: true } },
      },
    }),
    prisma.attendanceSession.findMany({
      where: { facultyId, deletedAt: null },
      orderBy: { date: 'desc' },
      take: 200,
      include: { subject: { select: { name: true, code: true } }, class: { select: { name: true } } },
    }),
  ]);

  const classIds = Array.from(new Set(classSubjects.map((c) => c.classId)));
  const roster = await prisma.student.findMany({
    where: { classId: { in: classIds }, deletedAt: null },
    include: { user: { select: { firstName: true, lastName: true } } },
  });

  const attendanceRows = roster.length
    ? await prisma.attendanceRecord.groupBy({
        by: ['studentId', 'status'],
        where: { studentId: { in: roster.map((s) => s.id) }, session: { deletedAt: null } },
        _count: { _all: true },
      })
    : [];

  const byStudent = new Map<string, { total: number; present: number }>();
  for (const row of attendanceRows) {
    const entry = byStudent.get(row.studentId) ?? { total: 0, present: 0 };
    entry.total += row._count._all;
    if (row.status !== 'ABSENT') entry.present += row._count._all;
    byStudent.set(row.studentId, entry);
  }
  const studentById = new Map(roster.map((s) => [s.id, s]));
  const atRiskList = Array.from(byStudent.entries())
    .map(([studentId, v]) => {
      const student = studentById.get(studentId);
      return {
        studentId,
        name: student ? `${student.user.firstName} ${student.user.lastName}` : 'Unknown',
        registerNumber: student?.registerNumber ?? '',
        className: student?.classId ? classIds.length : null,
        percentage: percent(v.present, v.total),
      };
    })
    .filter((s) => s.percentage < thresholds.safe && s.percentage >= 0)
    .sort((a, b) => a.percentage - b.percentage);

  const sessionTotals = computeTotals(
    sessions.flatMap((s) =>
      Array.from({ length: s.totalStudents }, (_, i) => (i < s.presentCount ? ('PRESENT' as const) : ('ABSENT' as const))),
    ),
    thresholds,
  );

  const attention: AttentionItem[] = [];
  if (pending.pending.length > 0) {
    attention.push({
      id: 'pending-marks',
      severity: 'high',
      title: `${pending.pending.length} assessment${pending.pending.length === 1 ? '' : 's'} awaiting marks`,
      detail: pending.pending.slice(0, 2).map((p) => `${p.name} · ${p.subjectName} · ${p.className}`).join('; '),
      href: '/academics',
      metric: `${pending.pending.reduce((a, p) => a + (p.expected - p.entered), 0)} marks`,
    });
  }
  if (atRiskList.length > 0) {
    attention.push({
      id: 'at-risk',
      severity: atRiskList.length > 5 ? 'medium' : 'low',
      title: `${atRiskList.length} student${atRiskList.length === 1 ? '' : 's'} below ${thresholds.safe}% attendance`,
      detail: atRiskList.slice(0, 2).map((s) => `${s.name} (${round(s.percentage, 0)}%)`).join('; '),
      href: '/students',
      metric: String(atRiskList.length),
    });
  }
  const markedToday = sessions.filter((s) => s.date.toDateString() === new Date().toDateString());
  const unmarkedToday = classSubjects.filter(
    (c) => !markedToday.some((s) => s.classId === c.classId && s.subjectId === c.subjectId),
  );
  if (unmarkedToday.length > 0 && markedToday.length < unmarkedToday.length) {
    attention.push({
      id: 'today-attendance',
      severity: 'low',
      title: `${unmarkedToday.length} class period${unmarkedToday.length === 1 ? '' : 's'} still to mark today`,
      detail: unmarkedToday.slice(0, 3).map((c) => `${c.class.name} · ${c.subject.name}`).join('; '),
      href: '/attendance',
      metric: String(unmarkedToday.length),
    });
  }

  return {
    role: 'FACULTY' as Role,
    greeting: greeting(),
    firstName: user.firstName,
    subtitle: user.departmentName ?? 'Faculty',
    attention: attention.slice(0, 5),
    actions: [
      { label: 'Mark attendance', href: '/attendance', description: 'Take today’s attendance in seconds', primary: true },
      { label: 'Enter IA marks', href: '/academics', description: 'Internal assessment entry and analytics' },
      { label: 'Upload results', href: '/results', description: 'Process a university result sheet' },
      { label: 'Open timetable', href: '/timetable', description: 'View or edit the weekly schedule' },
    ],
    stats: {
      subjects: assignments.length,
      classes: classIds.length,
      students: roster.length,
      sessionsTaken: sessions.length,
      classAttendance: sessionTotals.percentage,
      attendanceBand: sessionTotals.band,
      atRiskStudents: atRiskList.length,
      pendingAssessments: pending.pending.length,
      todayPeriods: today.items.length,
    },
    today: {
      day: today.day,
      isWorkingDay: today.isWorkingDay,
      items: today.items.map((i) => ({
        slotId: i.slotId,
        startTime: i.startTime,
        endTime: i.endTime,
        subjectName: i.subjectName,
        subjectCode: i.subjectCode,
        className: i.className,
        roomCode: i.roomCode,
        laboratoryName: i.laboratoryName,
      })),
      current: today.current ? { subjectName: today.current.subjectName, className: today.current.className } : null,
    },
    pendingAssessments: pending.pending.slice(0, 5),
    recentSessions: sessions.slice(0, 6).map((s) => ({
      id: s.id,
      date: s.date.toISOString(),
      periodIndex: s.periodIndex,
      subjectName: s.subject.name,
      className: s.class.name,
      presentCount: s.presentCount,
      totalStudents: s.totalStudents,
      percentage: s.totalStudents ? percent(s.presentCount, s.totalStudents) : 0,
    })),
    atRiskList: atRiskList.slice(0, 6).map(({ className: _c, ...rest }) => rest),
    notifications: notificationView(notifications),
    thresholds,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────────

export async function adminDashboard(user: AuthenticatedUser) {
  const { attendance: thresholds } = await getSettings();

  const [
    studentCount,
    facultyCount,
    departmentCount,
    classCount,
    subjectCount,
    openArrears,
    conflicts,
    results,
    recentAudit,
    notifications,
    recentStudents,
    iaMarks,
  ] = await Promise.all([
    prisma.student.count({ where: { deletedAt: null } }),
    prisma.faculty.count({ where: { deletedAt: null } }),
    prisma.department.count({ where: { deletedAt: null } }),
    prisma.class.count({ where: { deletedAt: null } }),
    prisma.subject.count({ where: { deletedAt: null } }),
    prisma.arrear.count({ where: { status: 'OPEN' } }),
    conflictCount(),
    resultAnalytics(),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 6, include: { user: { select: { firstName: true, lastName: true } } } }),
    prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 4 }),
    prisma.student.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { user: { select: { firstName: true, lastName: true } }, department: { select: { code: true } } },
    }),
    prisma.iAMark.findMany({
      where: { iaExam: { deletedAt: null } },
      select: { marks: true, isAbsent: true, iaExam: { select: { maxMarks: true } } },
      take: 20000,
    }),
  ]);

  // Institution-wide attendance per student → risk list + distribution
  const attendanceRows = await prisma.attendanceRecord.groupBy({
    by: ['studentId', 'status'],
    where: { session: { deletedAt: null } },
    _count: { _all: true },
  });
  const tally = new Map<string, { total: number; present: number }>();
  for (const row of attendanceRows) {
    const entry = tally.get(row.studentId) ?? { total: 0, present: 0 };
    entry.total += row._count._all;
    if (row.status !== 'ABSENT') entry.present += row._count._all;
    tally.set(row.studentId, entry);
  }
  const percentages = Array.from(tally.values())
    .filter((v) => v.total > 0)
    .map((v) => percent(v.present, v.total));
  const studentsAtRisk = percentages.filter((p) => p < thresholds.safe).length;

  const buckets = [
    { label: `${thresholds.safe}%+`, min: thresholds.safe, max: 101 },
    { label: `${thresholds.fine}–${thresholds.safe - 1}%`, min: thresholds.fine, max: thresholds.safe },
    { label: `${thresholds.debar}–${thresholds.fine - 1}%`, min: thresholds.debar, max: thresholds.fine },
    { label: `Below ${thresholds.debar}%`, min: 0, max: thresholds.debar },
  ];
  const attendanceDistribution = buckets.map((b) => ({
    label: b.label,
    count: percentages.filter((p) => p >= b.min && p < b.max).length,
  }));

  const attendanceTotals = computeTotals(
    Array.from(tally.values()).flatMap((v) =>
      Array.from({ length: v.total }, (_, i) => (i < v.present ? ('PRESENT' as const) : ('ABSENT' as const))),
    ),
    thresholds,
  );

  const iaAverage = iaMarks.length
    ? round(average(iaMarks.filter((m) => !m.isAbsent).map((m) => (m.marks / m.iaExam.maxMarks) * 100)), 1)
    : 0;

  const attention: AttentionItem[] = [];
  if (conflicts.errors > 0) {
    attention.push({
      id: 'conflicts',
      severity: 'high',
      title: `${conflicts.errors} timetable conflict${conflicts.errors === 1 ? '' : 's'}`,
      detail: 'Faculty, room or laboratory double-bookings must be resolved before publishing.',
      href: '/timetable',
      metric: String(conflicts.errors),
    });
  }
  if (studentsAtRisk > 0) {
    attention.push({
      id: 'at-risk',
      severity: studentsAtRisk > 10 ? 'high' : 'medium',
      title: `${studentsAtRisk} student${studentsAtRisk === 1 ? '' : 's'} below ${thresholds.safe}% attendance`,
      detail: 'Institution-wide attendance risk list.',
      href: '/analytics',
      metric: String(studentsAtRisk),
    });
  }
  if (openArrears > 0) {
    attention.push({
      id: 'arrears',
      severity: 'medium',
      title: `${openArrears} open arrear${openArrears === 1 ? '' : 's'}`,
      detail: 'Track clearance in the results module.',
      href: '/results',
      metric: String(openArrears),
    });
  }
  if (results.overallPassPercentage > 0 && results.overallPassPercentage < 70) {
    attention.push({
      id: 'pass-rate',
      severity: 'medium',
      title: `Result pass percentage is ${results.overallPassPercentage}%`,
      detail: 'Below the 70% institutional target — review subject-wise performance.',
      href: '/analytics',
      metric: `${results.overallPassPercentage}%`,
    });
  }

  return {
    role: 'ADMIN' as Role,
    greeting: greeting(),
    firstName: user.firstName,
    subtitle: 'Institution overview',
    attention: attention.slice(0, 5),
    actions: [
      { label: 'Add a student', href: '/students', description: 'Create and enrol a new student', primary: true },
      { label: 'Publish timetables', href: '/timetable', description: 'Generate conflict-free schedules' },
      { label: 'Upload results', href: '/results', description: 'Process a university result sheet' },
      { label: 'Tune thresholds', href: '/settings', description: 'Attendance and academic rules' },
    ],
    stats: {
      students: studentCount,
      faculty: facultyCount,
      departments: departmentCount,
      classes: classCount,
      subjects: subjectCount,
      averageAttendance: attendanceTotals.percentage,
      attendanceBand: attendanceTotals.band,
      averageAcademicPerformance: iaAverage,
      passPercentage: results.overallPassPercentage,
      openArrears,
      clearedArrears: results.clearedArrears,
      timetableConflicts: conflicts.total,
      timetableErrors: conflicts.errors,
      studentsAtRisk,
      trackedStudents: tally.size,
    },
    charts: {
      attendanceDistribution,
      semesterPassTrend: results.semesterTrend,
      subjectPassRates: results.subjectPassRates.slice(0, 8),
      topArrearStudents: results.topArrearStudents.slice(0, 5),
    },
    recentAudit: recentAudit.map((a) => ({
      id: a.id,
      action: a.action,
      description: a.description,
      resourceType: a.resourceType,
      createdAt: a.createdAt.toISOString(),
      user: a.user ? `${a.user.firstName} ${a.user.lastName}` : 'System',
    })),
    recentStudents: recentStudents.map((s) => ({
      id: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`,
      registerNumber: s.registerNumber,
      departmentCode: s.department.code,
      createdAt: s.createdAt.toISOString(),
    })),
    notifications: notificationView(notifications),
    thresholds,
  };
}

export async function dashboardFor(user: AuthenticatedUser) {
  if (user.role === 'STUDENT') {
    if (!user.studentId) throw new Error('No student profile is linked to this account.');
    return studentDashboard(user, user.studentId);
  }
  if (user.role === 'FACULTY') {
    if (!user.facultyId) throw new Error('No faculty profile is linked to this account.');
    return facultyDashboard(user, user.facultyId);
  }
  return adminDashboard(user);
}
