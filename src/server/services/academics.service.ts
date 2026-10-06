import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';
import { average, clamp, groupBy, round } from '@/lib/utils';
import { badRequest, notFound, forbidden } from '@/server/api/errors';
import { getSettings } from './settings.service';
import { audit } from './audit.service';

// ─────────────────────────────────────────────────────────────────────────
// IA exam CRUD
// ─────────────────────────────────────────────────────────────────────────

export async function listIaExams(filter: { classId?: string; subjectId?: string; facultyId?: string } = {}) {
  const where: Prisma.IAExamWhereInput = {
    deletedAt: null,
    ...(filter.classId ? { classId: filter.classId } : {}),
    ...(filter.subjectId ? { subjectId: filter.subjectId } : {}),
    ...(filter.facultyId ? { facultyId: filter.facultyId } : {}),
  };
  const exams = await prisma.iAExam.findMany({
    where,
    orderBy: [{ examDate: 'desc' }, { examNumber: 'desc' }],
    include: {
      subject: { select: { id: true, code: true, name: true } },
      class: { select: { id: true, name: true, yearOfStudy: true, section: true } },
      _count: { select: { marks: true } },
    },
  });
  return exams.map((e) => ({
    id: e.id,
    name: e.name,
    examNumber: e.examNumber,
    examDate: e.examDate.toISOString(),
    maxMarks: e.maxMarks,
    weightage: e.weightage,
    subjectId: e.subjectId,
    subjectCode: e.subject.code,
    subjectName: e.subject.name,
    classId: e.classId,
    className: e.class.name,
    marksEntered: e._count.marks,
  }));
}

export interface IaExamInput {
  subjectId: string;
  classId: string;
  name: string;
  examNumber: number;
  examDate: Date;
  maxMarks: number;
  weightage?: number;
  facultyId?: string | null;
}

export async function createIaExam(input: IaExamInput, actorUserId: string) {
  const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
  const klass = await prisma.class.findUnique({ where: { id: input.classId } });
  if (!subject || subject.deletedAt) throw notFound('That subject does not exist.');
  if (!klass || klass.deletedAt) throw notFound('That class does not exist.');
  if (input.maxMarks <= 0 || input.maxMarks > 200) throw badRequest('Maximum marks must be between 1 and 200.');

  const linked = await prisma.classSubject.findFirst({
    where: { classId: input.classId, subjectId: input.subjectId },
  });
  if (!linked) throw badRequest(`${subject.code} is not assigned to ${klass.name}. Add it to the class first.`);

  const duplicate = await prisma.iAExam.findUnique({
    where: {
      subjectId_classId_examNumber: {
        subjectId: input.subjectId,
        classId: input.classId,
        examNumber: input.examNumber,
      },
    },
  });
  if (duplicate && !duplicate.deletedAt) {
    throw badRequest(`${duplicate.name} already exists for ${subject.name} in ${klass.name}.`);
  }

  const exam = await prisma.iAExam.create({
    data: {
      subjectId: input.subjectId,
      classId: input.classId,
      name: input.name,
      examNumber: input.examNumber,
      examDate: input.examDate,
      maxMarks: input.maxMarks,
      weightage: input.weightage ?? 1,
      facultyId: input.facultyId ?? null,
    },
  });

  audit({
    action: 'ia.create',
    resourceType: 'IAExam',
    resourceId: exam.id,
    description: `Created ${exam.name} for ${subject.name} · ${klass.name}`,
    newValue: { examNumber: exam.examNumber, maxMarks: exam.maxMarks },
    userId: actorUserId,
  });
  return exam;
}

export async function updateIaExam(id: string, patch: Partial<IaExamInput>, actorUserId: string) {
  const existing = await prisma.iAExam.findUnique({ where: { id }, include: { subject: true, class: true } });
  if (!existing || existing.deletedAt) throw notFound('That assessment does not exist.');

  const updated = await prisma.iAExam.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.examDate !== undefined ? { examDate: patch.examDate } : {}),
      ...(patch.maxMarks !== undefined ? { maxMarks: patch.maxMarks } : {}),
      ...(patch.weightage !== undefined ? { weightage: patch.weightage } : {}),
      ...(patch.facultyId !== undefined ? { facultyId: patch.facultyId } : {}),
    },
  });

  audit({
    action: 'ia.update',
    resourceType: 'IAExam',
    resourceId: id,
    description: `Updated ${existing.name} (${existing.subject.name} · ${existing.class.name})`,
    previousValue: { name: existing.name, maxMarks: existing.maxMarks, examDate: existing.examDate },
    newValue: { name: updated.name, maxMarks: updated.maxMarks, examDate: updated.examDate },
    userId: actorUserId,
  });
  return updated;
}

export async function deleteIaExam(id: string, actorUserId: string) {
  const exam = await prisma.iAExam.findUnique({ where: { id }, include: { subject: true } });
  if (!exam) throw notFound('That assessment does not exist.');
  await prisma.iAExam.update({ where: { id }, data: { deletedAt: new Date() } });
  audit({
    action: 'ia.delete',
    resourceType: 'IAExam',
    resourceId: id,
    description: `Deleted ${exam.name} (${exam.subject.name})`,
    previousValue: { name: exam.name },
    userId: actorUserId,
  });
  return { deleted: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Marks entry
// ─────────────────────────────────────────────────────────────────────────

export interface MarksheetRow {
  studentId: string;
  registerNumber: string;
  rollNumber: string | null;
  firstName: string;
  lastName: string;
  marks: number | null;
  isAbsent: boolean;
  remarks: string | null;
  markId: string | null;
  percentage: number | null;
}

export async function getMarksheet(iaExamId: string): Promise<{ exam: Awaited<ReturnType<typeof listIaExams>>[number]; rows: MarksheetRow[]; stats: { entered: number; average: number; highest: number; lowest: number; absent: number } }> {
  const exam = await prisma.iAExam.findUnique({
    where: { id: iaExamId },
    include: {
      subject: { select: { id: true, code: true, name: true } },
      class: { select: { id: true, name: true } },
      marks: { include: { student: true } },
    },
  });
  if (!exam || exam.deletedAt) throw notFound('That assessment does not exist.');

  const students = await prisma.student.findMany({
    where: { classId: exam.classId, deletedAt: null },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { registerNumber: 'asc' },
  });

  const markByStudent = new Map(exam.marks.map((m) => [m.studentId, m]));
  const rows: MarksheetRow[] = students.map((s) => {
    const mark = markByStudent.get(s.id);
    return {
      studentId: s.id,
      registerNumber: s.registerNumber,
      rollNumber: s.rollNumber,
      firstName: s.user.firstName,
      lastName: s.user.lastName,
      marks: mark && !mark.isAbsent ? mark.marks : null,
      isAbsent: mark?.isAbsent ?? false,
      remarks: mark?.remarks ?? null,
      markId: mark?.id ?? null,
      percentage: mark && !mark.isAbsent ? round((mark.marks / exam.maxMarks) * 100, 1) : null,
    };
  });

  const scored = rows.filter((r) => r.marks !== null).map((r) => r.marks as number);
  return {
    exam: {
      id: exam.id,
      name: exam.name,
      examNumber: exam.examNumber,
      examDate: exam.examDate.toISOString(),
      maxMarks: exam.maxMarks,
      weightage: exam.weightage,
      subjectId: exam.subject.id,
      subjectCode: exam.subject.code,
      subjectName: exam.subject.name,
      classId: exam.class.id,
      className: exam.class.name,
      marksEntered: exam.marks.length,
    },
    rows,
    stats: {
      entered: scored.length,
      average: scored.length ? round(average(scored), 1) : 0,
      highest: scored.length ? Math.max(...scored) : 0,
      lowest: scored.length ? Math.min(...scored) : 0,
      absent: rows.filter((r) => r.isAbsent).length,
    },
  };
}

export interface MarkEntry {
  studentId: string;
  marks: number | null;
  isAbsent?: boolean;
  remarks?: string | null;
}

export async function saveMarks(iaExamId: string, entries: MarkEntry[], actorUserId: string, actorRole: string) {
  const exam = await prisma.iAExam.findUnique({
    where: { id: iaExamId },
    include: { subject: true, class: true },
  });
  if (!exam || exam.deletedAt) throw notFound('That assessment does not exist.');
  if (entries.length === 0) throw badRequest('There is nothing to save.');

  if (actorRole === 'FACULTY') {
    const assignment = await prisma.facultySubject.findFirst({
      where: { subjectId: exam.subjectId },
      include: { faculty: true },
    });
    if (!assignment) throw forbidden('You are not assigned to this subject.');
  }

  const roster = await prisma.student.findMany({
    where: { classId: exam.classId, deletedAt: null },
    select: { id: true },
  });
  const rosterIds = new Set(roster.map((r) => r.id));

  const invalid = entries.filter((e) => !rosterIds.has(e.studentId));
  if (invalid.length) throw badRequest(`${invalid.length} student(s) are not in this class.`);

  const outOfRange = entries.filter(
    (e) => e.marks !== null && !e.isAbsent && (e.marks < 0 || e.marks > exam.maxMarks),
  );
  if (outOfRange.length) {
    throw badRequest(`Marks must be between 0 and ${exam.maxMarks} (${outOfRange.length} invalid entr${outOfRange.length === 1 ? 'y' : 'ies'}).`);
  }

  const saved = await prisma.$transaction(
    entries.map((entry) =>
      prisma.iAMark.upsert({
        where: { iaExamId_studentId: { iaExamId, studentId: entry.studentId } },
        create: {
          iaExamId,
          studentId: entry.studentId,
          marks: entry.isAbsent ? 0 : (entry.marks ?? 0),
          isAbsent: entry.isAbsent ?? false,
          remarks: entry.remarks ?? null,
        },
        update: {
          marks: entry.isAbsent ? 0 : (entry.marks ?? 0),
          isAbsent: entry.isAbsent ?? false,
          remarks: entry.remarks ?? null,
        },
      }),
    ),
  );

  audit({
    action: 'ia.marks.save',
    resourceType: 'IAMark',
    resourceId: iaExamId,
    description: `Saved ${saved.length} mark(s) for ${exam.name} · ${exam.subject.name} · ${exam.class.name}`,
    newValue: { count: saved.length },
    userId: actorUserId,
  });

  return { saved: saved.length };
}

export async function deleteMark(markId: string, actorUserId: string) {
  const mark = await prisma.iAMark.findUnique({ where: { id: markId }, include: { iaExam: true } });
  if (!mark) throw notFound('That mark entry does not exist.');
  await prisma.iAMark.delete({ where: { id: markId } });
  audit({
    action: 'ia.marks.delete',
    resourceType: 'IAMark',
    resourceId: markId,
    description: `Removed a ${mark.iaExam.name} mark entry`,
    previousValue: { marks: mark.marks },
    userId: actorUserId,
  });
  return { deleted: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────────────────────────────────

export interface StudentPerformance {
  studentId: string;
  userId: string;
  registerNumber: string;
  name: string;
  subjects: { subjectId: string; code: string; name: string; percentage: number; exams: { name: string; marks: number; maxMarks: number; percentage: number }[] }[];
  overall: number;
  rank?: number;
  trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
  delta: number;
  openArrears: number;
  needsAttention: boolean;
}

/**
 * Combined IA performance for a class: per-student, per-subject, plus the
 * improving / declining / attention cohorts the specification asks for.
 */
export async function classPerformance(classId: string) {
  const { academic } = await getSettings();

  const [klass, exams, students] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId }, include: { department: true } }),
    prisma.iAExam.findMany({
      where: { classId, deletedAt: null },
      include: {
        subject: { select: { id: true, code: true, name: true } },
        marks: { select: { studentId: true, marks: true, isAbsent: true } },
      },
      orderBy: { examNumber: 'asc' },
    }),
    prisma.student.findMany({
      where: { classId, deletedAt: null },
      include: { user: { select: { id: true, firstName: true, lastName: true } }, arrears: { where: { status: 'OPEN' } } },
      orderBy: { registerNumber: 'asc' },
    }),
  ]);

  if (!klass) throw notFound('That class does not exist.');

  const examsBySubject = groupBy(exams, (e) => e.subjectId);
  const perStudent: StudentPerformance[] = students.map((student) => {
    const subjects = Array.from(examsBySubject.entries()).map(([subjectId, subjectExams]) => {
      const series = subjectExams
        .map((exam) => {
          const mark = exam.marks.find((m) => m.studentId === student.id);
          if (!mark || mark.isAbsent) return null;
          return {
            name: exam.name,
            examNumber: exam.examNumber,
            marks: mark.marks,
            maxMarks: exam.maxMarks,
            percentage: round((mark.marks / exam.maxMarks) * 100, 1),
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null)
        .sort((a, b) => a.examNumber - b.examNumber);

      return {
        subjectId,
        code: subjectExams[0].subject.code,
        name: subjectExams[0].subject.name,
        percentage: series.length ? round(average(series.map((s) => s.percentage)), 1) : 0,
        exams: series.map(({ examNumber: _n, ...rest }) => rest),
      };
    });

    const scored = subjects.filter((s) => s.percentage > 0);
    const overall = scored.length ? round(average(scored.map((s) => s.percentage)), 1) : 0;

    // Trend: last exam minus first exam across all subjects
    const first = exams.filter((e) => e.examNumber === 1);
    const lastNumber = Math.max(0, ...exams.map((e) => e.examNumber));
    const last = exams.filter((e) => e.examNumber === lastNumber);
    const avgOf = (list: typeof exams) => {
      const values = list
        .map((e) => {
          const mark = e.marks.find((m) => m.studentId === student.id);
          return mark && !mark.isAbsent ? (mark.marks / e.maxMarks) * 100 : null;
        })
        .filter((v): v is number => v !== null);
      return values.length ? average(values) : null;
    };
    const firstAvg = avgOf(first);
    const lastAvg = avgOf(last);
    const delta = firstAvg !== null && lastAvg !== null ? round(lastAvg - firstAvg, 1) : 0;

    return {
      studentId: student.id,
      userId: student.user.id,
      registerNumber: student.registerNumber,
      name: `${student.user.firstName} ${student.user.lastName}`,
      subjects,
      overall,
      trend: delta >= 3 ? 'IMPROVING' : delta <= -3 ? 'DECLINING' : 'STABLE',
      delta,
      openArrears: student.arrears.length,
      needsAttention: overall > 0 && overall < academic.passMarkPercentage,
    };
  });

  const ranked = [...perStudent]
    .filter((s) => s.overall > 0)
    .sort((a, b) => b.overall - a.overall)
    .map((s, i) => ({ ...s, rank: i + 1 }));
  const rankById = new Map(ranked.map((s) => [s.studentId, s.rank as number]));
  for (const s of perStudent) s.rank = rankById.get(s.studentId);

  const subjectAverages = Array.from(examsBySubject.entries()).map(([subjectId, list]) => {
    const values = list.flatMap((e) => e.marks.filter((m) => !m.isAbsent).map((m) => (m.marks / e.maxMarks) * 100));
    return {
      subjectId,
      code: list[0].subject.code,
      name: list[0].subject.name,
      average: values.length ? round(average(values), 1) : 0,
      students: new Set(list.flatMap((e) => e.marks.map((m) => m.studentId))).size,
      exams: list.length,
    };
  });

  const examComparison = exams.map((e) => {
    const values = e.marks.filter((m) => !m.isAbsent).map((m) => round((m.marks / e.maxMarks) * 100, 1));
    return {
      examId: e.id,
      name: e.name,
      examNumber: e.examNumber,
      subjectId: e.subjectId,
      subjectName: e.subject.name,
      subjectCode: e.subject.code,
      maxMarks: e.maxMarks,
      average: values.length ? round(average(values), 1) : 0,
      highest: values.length ? Math.max(...values) : 0,
      lowest: values.length ? Math.min(...values) : 0,
      entries: e.marks.length,
      absent: e.marks.filter((m) => m.isAbsent).length,
    };
  });

  const scoredStudents = perStudent.filter((s) => s.overall > 0);
  return {
    classId,
    className: klass.name,
    studentCount: students.length,
    examCount: exams.length,
    average: scoredStudents.length ? round(average(scoredStudents.map((s) => s.overall)), 1) : 0,
    improving: perStudent.filter((s) => s.trend === 'IMPROVING').length,
    declining: perStudent.filter((s) => s.trend === 'DECLINING').length,
    stable: perStudent.filter((s) => s.trend === 'STABLE').length,
    attentionRequired: perStudent.filter((s) => s.needsAttention).length,
    topPerformers: ranked.slice(0, 6).map((s) => ({ studentId: s.studentId, name: s.name, registerNumber: s.registerNumber, overall: s.overall })),
    students: ranked.length ? ranked : perStudent,
    subjectAverages,
    examComparison,
    passMarkPercentage: academic.passMarkPercentage,
  };
}

/** One student's academic picture across every subject they are assessed in. */
export async function studentPerformance(studentId: string) {
  const marks = await prisma.iAMark.findMany({
    where: { studentId, iaExam: { deletedAt: null } },
    include: {
      iaExam: { include: { subject: { select: { id: true, code: true, name: true } }, class: { select: { name: true } } } },
    },
    orderBy: { iaExam: { examNumber: 'asc' } },
  });

  if (marks.length === 0) {
    return { subjects: [], overall: 0, trend: [] as { name: string; percentage: number }[], examCount: 0, rank: null, classAverage: 0 };
  }

  const bySubject = groupBy(marks, (m) => m.iaExam.subjectId);
  const subjects = Array.from(bySubject.entries()).map(([subjectId, rows]) => {
    const values = rows.filter((r) => !r.isAbsent).map((r) => round((r.marks / r.iaExam.maxMarks) * 100, 1));
    return {
      subjectId,
      code: rows[0].iaExam.subject.code,
      name: rows[0].iaExam.subject.name,
      percentage: values.length ? round(average(values), 1) : 0,
      exams: rows.map((r) => ({
        id: r.id,
        name: r.iaExam.name,
        examNumber: r.iaExam.examNumber,
        marks: r.isAbsent ? null : r.marks,
        maxMarks: r.iaExam.maxMarks,
        percentage: r.isAbsent ? null : round((r.marks / r.iaExam.maxMarks) * 100, 1),
        isAbsent: r.isAbsent,
        date: r.iaExam.examDate.toISOString(),
      })),
    };
  });

  const overall = round(average(subjects.map((s) => s.percentage).filter((p) => p > 0)), 1);

  // Trend per exam number
  const byExamNumber = groupBy(marks, (m) => String(m.iaExam.examNumber));
  const trend = Array.from(byExamNumber.entries())
    .map(([num, rows]) => {
      const values = rows.filter((r) => !r.isAbsent).map((r) => (r.marks / r.iaExam.maxMarks) * 100);
      return { name: rows[0].iaExam.name, examNumber: Number(num), percentage: values.length ? round(average(values), 1) : 0 };
    })
    .sort((a, b) => a.examNumber - b.examNumber);

  // Rank within the class
  const classId = marks[0].iaExam.classId;
  const classmates = await prisma.iAMark.findMany({
    where: { iaExam: { classId, deletedAt: null } },
    select: { studentId: true, marks: true, isAbsent: true, iaExam: { select: { maxMarks: true } } },
  });
  const perClassmate = groupBy(classmates, (m) => m.studentId);
  const averages = Array.from(perClassmate.entries())
    .map(([sid, rows]) => {
      const values = rows.filter((r) => !r.isAbsent).map((r) => (r.marks / r.iaExam.maxMarks) * 100);
      return { sid, avg: values.length ? average(values) : 0 };
    })
    .filter((a) => a.avg > 0)
    .sort((a, b) => b.avg - a.avg);
  const rank = averages.findIndex((a) => a.sid === studentId) + 1;
  const classAverage = averages.length ? round(average(averages.map((a) => a.avg)), 1) : 0;

  return {
    subjects,
    overall,
    trend: trend.map((t) => ({ name: t.name, percentage: t.percentage })),
    examCount: new Set(marks.map((m) => m.iaExamId)).size,
    rank: rank > 0 ? rank : null,
    classSize: averages.length,
    classAverage,
  };
}

/** Faculty landing data: which assessments still need marks. */
export async function pendingAssessments(facultyId: string) {
  const assignments = await prisma.facultySubject.findMany({
    where: { facultyId },
    include: { subject: { select: { id: true, code: true, name: true } } },
  });
  const subjectIds = assignments.map((a) => a.subjectId);
  if (subjectIds.length === 0) return { pending: [], subjects: [] };

  const exams = await prisma.iAExam.findMany({
    where: { subjectId: { in: subjectIds }, deletedAt: null },
    include: {
      class: { select: { id: true, name: true, _count: { select: { students: true } } } },
      _count: { select: { marks: true } },
    },
    orderBy: { examDate: 'desc' },
  });

  const pending = exams
    .map((e) => ({
      id: e.id,
      name: e.name,
      subjectName: assignments.find((a) => a.subjectId === e.subjectId)?.subject.name ?? '',
      subjectCode: assignments.find((a) => a.subjectId === e.subjectId)?.subject.code ?? '',
      className: e.class.name,
      classId: e.classId,
      examDate: e.examDate.toISOString(),
      maxMarks: e.maxMarks,
      entered: e._count.marks,
      expected: e.class._count.students,
    }))
    .filter((e) => e.entered < e.expected)
    .sort((a, b) => b.expected - b.entered - (a.expected - a.entered));

  return { pending: pending.slice(0, 10), subjects: assignments.map((a) => a.subject) };
}

export const clampMarks = (value: number, maxMarks: number) => clamp(value, 0, maxMarks);
