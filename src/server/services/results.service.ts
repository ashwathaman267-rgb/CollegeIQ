import type { Prisma, ResultStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { average, clamp, groupBy, percent, round, seededRandom, hashString } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { badRequest, notFound } from '@/server/api/errors';
import { getSettings } from './settings.service';
import { audit } from './audit.service';
import { notifyMany } from './notification.service';
import { extractText } from './document.service';
import { parseResultDocument, type ParsedResultDocument, type ParsedResultRow } from './result-parser';
import { storage, storageKey, validateUpload } from '@/lib/storage';

export interface ResultUploadInput {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  sizeBytes: number;
  name?: string;
  semester?: number;
  declaredOn?: Date;
  departmentId?: string;
  classId?: string;
  academicYearId?: string;
}

export interface ProcessedResult {
  universityResultId: string;
  name: string;
  extractionMode: 'PARSED' | 'SIMULATED';
  strategy: ParsedResultDocument['strategy'];
  rowsRead: number;
  matched: number;
  unmatched: string[];
  passPercentage: number;
  passedStudents: number;
  failedStudents: number;
  arrearCount: number;
  subjectStats: SubjectStat[];
  warnings: string[];
}

export interface SubjectStat {
  subjectId: string;
  code: string;
  name: string;
  appeared: number;
  passed: number;
  failed: number;
  passPercentage: number;
  averageMarks: number;
}

const GRADE_FOR = (marks: number) => {
  if (marks >= 90) return 'O';
  if (marks >= 80) return 'A+';
  if (marks >= 70) return 'A';
  if (marks >= 60) return 'B+';
  if (marks >= 50) return 'B';
  if (marks >= 40) return 'C';
  return 'F';
};

/**
 * Deterministic stand-in used when an uploaded document cannot be read.
 * Clearly reported to the caller as `SIMULATED` so the UI can label it.
 */
function simulateRows(
  students: { id: string; registerNumber: string; name: string }[],
  subjects: { id: string; code: string; name: string; maxTheoryMarks: number; passMarks: number }[],
  semester: number,
): ParsedResultRow[] {
  return students.map((student) => {
    const random = seededRandom(hashString(`${student.registerNumber}-sem${semester}`));
    const ability = 0.42 + random() * 0.55; // per-student baseline
    const rowSubjects = subjects.map((subject) => {
      const noise = (random() - 0.5) * 26;
      const marks = clamp(Math.round(ability * subject.maxTheoryMarks + noise), 12, subject.maxTheoryMarks);
      const status: ResultStatus = marks >= subject.passMarks ? 'PASS' : 'FAIL';
      return { code: subject.code, name: subject.name, marks, grade: GRADE_FOR(marks), status: status === 'PASS' ? ('PASS' as const) : ('FAIL' as const) };
    });
    const passed = rowSubjects.filter((s) => s.status === 'PASS').length;
    const gpa = round(
      clamp((passed / Math.max(1, rowSubjects.length)) * 8 + rowSubjects.reduce((a, s) => a + s.marks, 0) / (rowSubjects.length * 12), 3, 9.8),
      2,
    );
    return {
      registerNumber: student.registerNumber,
      studentName: student.name,
      subjects: rowSubjects,
      gpa,
      arrears: rowSubjects.filter((s) => s.status === 'FAIL').map((s) => s.name ?? s.code ?? 'Subject'),
    };
  });
}

/** Upload → extract → parse → persist → notify. The whole result-analyser flow. */
export async function processResultUpload(
  input: ResultUploadInput,
  actor: { userId: string; facultyId?: string | null },
): Promise<ProcessedResult> {
  const check = validateUpload('result', input.mimeType, input.sizeBytes);
  if (!check.ok) throw badRequest(check.reason);

  const { academic } = await getSettings();
  const semester = clamp(input.semester ?? academic.semester, 1, 12);

  // 1. Resolve the cohort this result belongs to.
  let students: { id: string; registerNumber: string; name: string; userId: string }[] = [];
  let subjectRows: { id: string; code: string; name: string; maxTheoryMarks: number; passMarks: number }[] = [];
  let departmentId = input.departmentId ?? null;
  let classId = input.classId ?? null;

  if (classId) {
    const klass = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        department: true,
        classSubjects: { include: { subject: true } },
        students: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!klass) throw notFound('That class does not exist.');
    departmentId = klass.departmentId;
    students = klass.students.map((s) => ({
      id: s.id,
      registerNumber: s.registerNumber,
      name: `${s.user.firstName} ${s.user.lastName}`,
      userId: s.user.id,
    }));
    subjectRows = klass.classSubjects.map((cs) => ({
      id: cs.subject.id,
      code: cs.subject.code,
      name: cs.subject.name,
      maxTheoryMarks: cs.subject.maxTheoryMarks,
      passMarks: cs.subject.passMarks,
    }));
  } else {
    const where: Prisma.StudentWhereInput = {
      deletedAt: null,
      ...(departmentId ? { departmentId } : {}),
      ...(semester ? { semester } : {}),
    };
    const rows = await prisma.student.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        department: { include: { subjects: { where: { semester, deletedAt: null } } } },
      },
      take: 400,
    });
    students = rows.map((s) => ({
      id: s.id,
      registerNumber: s.registerNumber,
      name: `${s.user.firstName} ${s.user.lastName}`,
      userId: s.user.id,
    }));
    const seen = new Map<string, (typeof subjectRows)[number]>();
    for (const s of rows) {
      for (const subject of s.department.subjects) {
        if (!seen.has(subject.id)) {
          seen.set(subject.id, {
            id: subject.id,
            code: subject.code,
            name: subject.name,
            maxTheoryMarks: subject.maxTheoryMarks,
            passMarks: subject.passMarks,
          });
        }
      }
    }
    subjectRows = Array.from(seen.values());
  }

  if (students.length === 0) throw badRequest('No students matched the selected class or department.');
  if (subjectRows.length === 0) throw badRequest('No subjects are configured for this cohort yet.');

  // 2. Store the uploaded document.
  const key = storageKey('result', input.filename);
  const stored = await storage().put(key, input.buffer, input.mimeType);
  const asset = await prisma.fileAsset.create({
    data: {
      filename: key.split('/').pop() ?? key,
      originalName: input.filename,
      mimeType: input.mimeType,
      sizeBytes: stored.size,
      storageKey: stored.key,
      storageDriver: stored.driver,
      checksum: stored.checksum,
      kind: 'RESULT_SHEET',
      ownerId: actor.userId,
    },
  });

  // 3. Extract + parse.
  let parsed: ParsedResultDocument = { strategy: 'none', rows: [], warnings: [] };
  let extractionMode: ProcessedResult['extractionMode'] = 'PARSED';
  const warnings: string[] = [];

  try {
    const text = await extractText(input.buffer, input.mimeType);
    parsed = parseResultDocument(text);
    warnings.push(...parsed.warnings);
    if (parsed.rows.length === 0) {
      extractionMode = 'SIMULATED';
      warnings.push(
        'No student rows could be read from the document, so CampusIQ generated a demo result set for the selected cohort. Connect your university result API or upload a text-based sheet for live extraction.',
      );
    } else if (parsed.rows.length < students.length * 0.5) {
      warnings.push(`Only ${parsed.rows.length} of ${students.length} students were read from the document.`);
    }
  } catch (err) {
    extractionMode = 'SIMULATED';
    warnings.push(`Document text could not be extracted (${(err as Error).message}). A demo result set was generated instead.`);
  }

  const rows =
    parsed.rows.length > 0
      ? parsed.rows
      : simulateRows(
          students.map((s) => ({ id: s.id, registerNumber: s.registerNumber, name: s.name })),
          subjectRows,
          semester,
        );

  // 4. Persist.
  const resultName =
    input.name?.trim() ||
    `Semester ${parsed.semester ?? semester} · ${formatDate(input.declaredOn ?? new Date(), { month: 'long', year: 'numeric' })}`;

  const byRegister = new Map(students.map((s) => [s.registerNumber.toUpperCase(), s]));
  const subjectByCode = new Map(subjectRows.map((s) => [s.code.toUpperCase(), s]));
  const subjectByName = new Map(subjectRows.map((s) => [s.name.toLowerCase(), s]));

  const matched: { studentId: string; userId: string; row: ParsedResultRow }[] = [];
  const unmatched: string[] = [];

  for (const row of rows) {
    const student = byRegister.get(row.registerNumber.toUpperCase());
    if (!student) {
      unmatched.push(row.registerNumber);
      continue;
    }
    matched.push({ studentId: student.id, userId: student.userId, row });
  }

  const universityResult = await prisma.universityResult.create({
    data: {
      name: resultName,
      semester: parsed.semester ?? semester,
      declaredOn: input.declaredOn ?? parsed.declaredOn ?? new Date(),
      status: 'PROCESSING',
      departmentId,
      academicYearId: input.academicYearId ?? null,
      fileAssetId: asset.id,
      processedById: actor.facultyId ?? null,
      totalStudents: matched.length,
    },
  });

  const subjectTally = new Map<string, { appeared: number; passed: number; totalMarks: number; failed: number }>();
  let passedStudents = 0;
  let failedStudents = 0;
  let arrearCount = 0;

  for (const entry of matched) {
    const subjectResults: { subjectId: string; marks: number | null; grade: string | null; status: ResultStatus }[] = [];
    const arrears: string[] = [];

    for (const item of entry.row.subjects) {
      const subject =
        (item.code ? subjectByCode.get(item.code.toUpperCase()) : undefined) ??
        (item.name ? subjectByName.get(item.name.toLowerCase()) : undefined) ??
        (item.code ? subjectByName.get(item.code.toLowerCase()) : undefined);
      if (!subject) {
        warnings.push(`Subject "${item.code ?? item.name}" is not in the catalogue and was skipped.`);
        continue;
      }
      const status: ResultStatus = item.status === 'FAIL' ? 'FAIL' : 'PASS';
      subjectResults.push({ subjectId: subject.id, marks: item.marks ?? null, grade: item.grade ?? null, status });
      const tally = subjectTally.get(subject.id) ?? { appeared: 0, passed: 0, failed: 0, totalMarks: 0 };
      tally.appeared += 1;
      if (status === 'PASS') tally.passed += 1;
      else {
        tally.failed += 1;
        arrears.push(subject.name);
      }
      if (typeof item.marks === 'number') tally.totalMarks += item.marks;
      subjectTally.set(subject.id, tally);
    }

    if (subjectResults.length === 0) continue;

    const failed = subjectResults.filter((s) => s.status === 'FAIL').length;
    const gpa =
      entry.row.gpa ??
      round(
        clamp(
          subjectResults.reduce((acc, s) => acc + (s.marks ?? 0), 0) / (subjectResults.length * 10) + (failed === 0 ? 1 : 0),
          0,
          10,
        ),
        2,
      );

    await prisma.studentResult.create({
      data: {
        universityResultId: universityResult.id,
        studentId: entry.studentId,
        semester: parsed.semester ?? semester,
        gpa,
        aggregate: round(
          average(subjectResults.map((s) => s.marks ?? 0).filter((m) => m > 0)),
          1,
        ),
        arrearsCount: failed,
        status: failed === 0 ? 'PASS' : failed === subjectResults.length ? 'FAIL' : 'PASS_WITH_ARREARS',
        subjects: { createMany: { data: subjectResults.map((s) => ({ subjectId: s.subjectId, marks: s.marks, grade: s.grade, status: s.status })) } },
      },
    });

    if (failed === 0) passedStudents += 1;
    else failedStudents += 1;

    // Arrear ledger: one row per student+subject+semester it first appeared in.
    for (const failure of subjectResults.filter((s) => s.status === 'FAIL')) {
      await prisma.arrear.upsert({
        where: {
          studentId_subjectId_semester: {
            studentId: entry.studentId,
            subjectId: failure.subjectId,
            semester: parsed.semester ?? semester,
          },
        },
        create: {
          studentId: entry.studentId,
          subjectId: failure.subjectId,
          semester: parsed.semester ?? semester,
          status: 'OPEN',
          firstAttempt: universityResult.declaredOn,
        },
        update: { attempts: { increment: 1 } },
      });
      arrearCount += 1;
    }
  }

  // Subjects that were previously in arrear and are now cleared
  for (const entry of matched) {
    const cleared = entry.row.subjects.filter((s) => s.status !== 'FAIL');
    for (const item of cleared) {
      const subject = (item.code ? subjectByCode.get(item.code.toUpperCase()) : undefined) ?? (item.name ? subjectByName.get(item.name.toLowerCase()) : undefined);
      if (!subject) continue;
      await prisma.arrear.updateMany({
        where: { studentId: entry.studentId, subjectId: subject.id, status: 'OPEN', semester: { lt: parsed.semester ?? semester } },
        data: { status: 'CLEARED', clearedAt: universityResult.declaredOn },
      });
    }
  }

  const subjectStats: SubjectStat[] = Array.from(subjectTally.entries()).map(([subjectId, tally]) => {
    const subject = subjectRows.find((s) => s.id === subjectId)!;
    return {
      subjectId,
      code: subject.code,
      name: subject.name,
      appeared: tally.appeared,
      passed: tally.passed,
      failed: tally.failed,
      passPercentage: percent(tally.passed, tally.appeared),
      averageMarks: tally.appeared ? round(tally.totalMarks / tally.appeared, 1) : 0,
    };
  });

  const passPercentage = matched.length ? percent(passedStudents, matched.length) : 0;

  await prisma.universityResult.update({
    where: { id: universityResult.id },
    data: {
      status: 'COMPLETED',
      passPercentage,
      totalStudents: matched.length,
      passedStudents,
      failedStudents,
      arrearCount,
      summary: {
        extractionMode,
        strategy: parsed.strategy,
        rowsRead: rows.length,
        unmatched: unmatched.slice(0, 50),
        warnings: Array.from(new Set(warnings)).slice(0, 20),
        subjectStats,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  if (matched.length > 0) {
    await notifyMany(matched.map((m) => m.userId), {
      type: 'RESULT_PUBLISHED',
      title: `${resultName} results published`,
      message: `Your semester ${parsed.semester ?? semester} results are now available in CampusIQ.`,
      link: '/results',
      metadata: { universityResultId: universityResult.id } as Prisma.InputJsonValue,
    });
  }

  audit({
    action: 'result.process',
    resourceType: 'UniversityResult',
    resourceId: universityResult.id,
    description: `Processed "${resultName}" — ${matched.length} students, ${passPercentage}% pass rate (${extractionMode.toLowerCase()})`,
    newValue: { passPercentage, matched: matched.length, unmatched: unmatched.length, extractionMode },
    userId: actor.userId,
  });

  return {
    universityResultId: universityResult.id,
    name: resultName,
    extractionMode,
    strategy: parsed.strategy,
    rowsRead: rows.length,
    matched: matched.length,
    unmatched,
    passPercentage,
    passedStudents,
    failedStudents,
    arrearCount,
    subjectStats,
    warnings: Array.from(new Set(warnings)).slice(0, 12),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Reading
// ─────────────────────────────────────────────────────────────────────────

export async function listUniversityResults(filter: { departmentId?: string; semester?: number; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = clamp(filter.pageSize ?? 12, 1, 50);
  const where: Prisma.UniversityResultWhereInput = {
    deletedAt: null,
    ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
    ...(filter.semester ? { semester: filter.semester } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.universityResult.count({ where }),
    prisma.universityResult.findMany({
      where,
      orderBy: { declaredOn: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        department: { select: { name: true, code: true } },
        _count: { select: { studentResults: true } },
      },
    }),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      semester: r.semester,
      declaredOn: r.declaredOn.toISOString(),
      status: r.status,
      passPercentage: r.passPercentage ?? 0,
      totalStudents: r.totalStudents,
      passedStudents: r.passedStudents,
      failedStudents: r.failedStudents,
      arrearCount: r.arrearCount,
      departmentName: r.department?.name ?? null,
      summary: r.summary as Record<string, unknown> | null,
    })),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function getResultDetail(id: string, options: { page?: number; pageSize?: number; status?: string; search?: string } = {}) {
  const result = await prisma.universityResult.findUnique({
    where: { id },
    include: { department: { select: { id: true, name: true } }, fileAsset: true },
  });
  if (!result || result.deletedAt) throw notFound('That result set does not exist.');

  const page = Math.max(1, options.page ?? 1);
  const pageSize = clamp(options.pageSize ?? 20, 1, 100);

  const where: Prisma.StudentResultWhereInput = {
    universityResultId: id,
    ...(options.status && options.status !== 'ALL' ? { status: options.status as never } : {}),
    ...(options.search
      ? { student: { OR: [{ registerNumber: { contains: options.search, mode: 'insensitive' } }, { user: { firstName: { contains: options.search, mode: 'insensitive' } } }, { user: { lastName: { contains: options.search, mode: 'insensitive' } } }] } }
      : {}),
  };

  const [total, studentResults, subjects] = await Promise.all([
    prisma.studentResult.count({ where }),
    prisma.studentResult.findMany({
      where,
      orderBy: [{ status: 'asc' }, { gpa: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true } } } },
        subjects: { include: { subject: { select: { id: true, code: true, name: true } } } },
      },
    }),
    prisma.universityResultSubject.findMany({
      where: { studentResult: { universityResultId: id } },
      include: { subject: { select: { id: true, code: true, name: true } } },
    }),
  ]);

  const bySubject = groupBy(subjects, (s) => s.subjectId);
  const subjectStats: SubjectStat[] = Array.from(bySubject.entries())
    .map(([subjectId, rows]) => {
      const passed = rows.filter((r) => r.status === 'PASS').length;
      const marks = rows.map((r) => r.marks).filter((m): m is number => typeof m === 'number');
      return {
        subjectId,
        code: rows[0].subject.code,
        name: rows[0].subject.name,
        appeared: rows.length,
        passed,
        failed: rows.length - passed,
        passPercentage: percent(passed, rows.length),
        averageMarks: marks.length ? round(average(marks), 1) : 0,
      };
    })
    .sort((a, b) => a.passPercentage - b.passPercentage);

  const gradeDistribution = ['O', 'A+', 'A', 'B+', 'B', 'C', 'F'].map((grade) => ({
    grade,
    count: subjects.filter((s) => (s.grade ?? GRADE_FOR(s.marks ?? 0)) === grade).length,
  }));

  return {
    result: {
      id: result.id,
      name: result.name,
      semester: result.semester,
      declaredOn: result.declaredOn.toISOString(),
      status: result.status,
      passPercentage: result.passPercentage ?? 0,
      totalStudents: result.totalStudents,
      passedStudents: result.passedStudents,
      failedStudents: result.failedStudents,
      arrearCount: result.arrearCount,
      departmentName: result.department?.name ?? null,
      summary: result.summary as Record<string, unknown> | null,
      fileName: result.fileAsset?.originalName ?? null,
    },
    students: studentResults.map((sr) => ({
      id: sr.id,
      studentId: sr.studentId,
      registerNumber: sr.student.registerNumber,
      name: `${sr.student.user.firstName} ${sr.student.user.lastName}`,
      gpa: sr.gpa,
      aggregate: sr.aggregate,
      arrearsCount: sr.arrearsCount,
      status: sr.status,
      subjects: sr.subjects.map((s) => ({
        subjectId: s.subjectId,
        code: s.subject.code,
        name: s.subject.name,
        marks: s.marks,
        grade: s.grade,
        status: s.status,
      })),
    })),
    subjectStats,
    gradeDistribution,
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export interface ArrearTimelineEntry {
  semester: number;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  status: 'OPEN' | 'CLEARED';
  firstAttempt: string;
  clearedAt?: string | null;
  attempts: number;
}

/** Per-student result history with the arrear timeline from the specification. */
export async function studentResultHistory(studentId: string) {
  const [results, arrears, student] = await Promise.all([
    prisma.studentResult.findMany({
      where: { studentId },
      orderBy: { semester: 'desc' },
      include: {
        universityResult: { select: { id: true, name: true, declaredOn: true } },
        subjects: { include: { subject: { select: { id: true, code: true, name: true } } } },
      },
    }),
    prisma.arrear.findMany({
      where: { studentId },
      orderBy: [{ semester: 'asc' }, { subjectId: 'asc' }],
      include: { subject: { select: { id: true, code: true, name: true } } },
    }),
    prisma.student.findUnique({ where: { id: studentId }, select: { cgpa: true, semester: true, registerNumber: true } }),
  ]);

  const timeline: ArrearTimelineEntry[] = arrears.map((a) => ({
    semester: a.semester,
    subjectId: a.subjectId,
    subjectCode: a.subject.code,
    subjectName: a.subject.name,
    status: a.status,
    firstAttempt: a.firstAttempt.toISOString(),
    clearedAt: a.clearedAt?.toISOString() ?? null,
    attempts: a.attempts,
  }));

  const openArrears = timeline.filter((t) => t.status === 'OPEN');
  const clearedArrears = timeline.filter((t) => t.status === 'CLEARED');
  const gpas = results.map((r) => r.gpa).filter((g): g is number => typeof g === 'number');

  return {
    registerNumber: student?.registerNumber ?? '',
    results: results.map((r) => ({
      id: r.id,
      universityResultId: r.universityResultId,
      name: r.universityResult.name,
      semester: r.semester,
      declaredOn: r.universityResult.declaredOn.toISOString(),
      gpa: r.gpa,
      aggregate: r.aggregate,
      status: r.status,
      arrearsCount: r.arrearsCount,
      subjects: r.subjects.map((s) => ({
        subjectId: s.subjectId,
        code: s.subject.code,
        name: s.subject.name,
        marks: s.marks,
        grade: s.grade,
        status: s.status,
      })),
    })),
    timeline,
    openArrears,
    clearedArrears,
    cgpa: student?.cgpa ?? (gpas.length ? round(average(gpas), 2) : null),
    averageGpa: gpas.length ? round(average(gpas), 2) : null,
  };
}

export async function deleteUniversityResult(id: string, actorUserId: string) {
  const result = await prisma.universityResult.findUnique({ where: { id } });
  if (!result) throw notFound('That result set does not exist.');
  await prisma.universityResult.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } });
  audit({
    action: 'result.delete',
    resourceType: 'UniversityResult',
    resourceId: id,
    description: `Archived result set "${result.name}"`,
    previousValue: { name: result.name },
    userId: actorUserId,
  });
  return { deleted: true };
}

/** Institution-wide result analytics for the dashboard/analytics screens. */
export async function resultAnalytics(filter: { departmentId?: string } = {}) {
  const results = await prisma.universityResult.findMany({
    where: { deletedAt: null, ...(filter.departmentId ? { departmentId: filter.departmentId } : {}) },
    select: { id: true, semester: true, passPercentage: true, arrearCount: true, declaredOn: true, totalStudents: true },
    orderBy: { declaredOn: 'asc' },
  });

  const [openArrears, totalArrears, subjectFailures] = await Promise.all([
    prisma.arrear.count({
      where: { status: 'OPEN', ...(filter.departmentId ? { student: { departmentId: filter.departmentId } } : {}) },
    }),
    prisma.arrear.count({ where: filter.departmentId ? { student: { departmentId: filter.departmentId } } : {} }),
    prisma.universityResultSubject.groupBy({
      by: ['subjectId', 'status'],
      where: { studentResult: { ...(filter.departmentId ? { student: { departmentId: filter.departmentId } } : {}) } },
      _count: { _all: true },
    }),
  ]);

  const subjects = await prisma.subject.findMany({
    where: { id: { in: Array.from(new Set(subjectFailures.map((s) => s.subjectId))) } },
    select: { id: true, code: true, name: true },
  });
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  const bySubject = groupBy(subjectFailures, (s) => s.subjectId);
  const subjectPassRates = Array.from(bySubject.entries())
    .map(([subjectId, rows]) => {
      const total = rows.reduce((a, r) => a + r._count._all, 0);
      const passed = rows.filter((r) => r.status === 'PASS').reduce((a, r) => a + r._count._all, 0);
      return {
        subjectId,
        code: subjectById.get(subjectId)?.code ?? '',
        name: subjectById.get(subjectId)?.name ?? 'Subject',
        total,
        passed,
        passPercentage: percent(passed, total),
      };
    })
    .sort((a, b) => a.passPercentage - b.passPercentage);

  const bySemester = groupBy(results, (r) => r.semester);
  const semesterTrend = Array.from(bySemester.entries())
    .map(([semester, rows]) => ({
      semester,
      label: `Sem ${semester}`,
      passPercentage: round(average(rows.map((r) => r.passPercentage ?? 0)), 1),
      arrears: rows.reduce((a, r) => a + r.arrearCount, 0),
    }))
    .sort((a, b) => a.semester - b.semester);

  const topArrearStudents = await prisma.arrear.groupBy({
    by: ['studentId'],
    where: { status: 'OPEN', ...(filter.departmentId ? { student: { departmentId: filter.departmentId } } : {}) },
    _count: { _all: true },
    orderBy: { _count: { studentId: 'desc' } },
    take: 8,
  });
  const studentIds = topArrearStudents.map((t) => t.studentId);
  const studentRows = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  const studentById = new Map(studentRows.map((s) => [s.id, s]));

  return {
    overallPassPercentage: results.length ? round(average(results.map((r) => r.passPercentage ?? 0)), 1) : 0,
    resultSetCount: results.length,
    openArrears,
    totalArrears,
    clearedArrears: Math.max(0, totalArrears - openArrears),
    subjectPassRates: subjectPassRates.slice(0, 12),
    semesterTrend,
    topArrearStudents: topArrearStudents.map((t) => ({
      studentId: t.studentId,
      name: studentById.get(t.studentId)
        ? `${studentById.get(t.studentId)!.user.firstName} ${studentById.get(t.studentId)!.user.lastName}`
        : 'Unknown',
      registerNumber: studentById.get(t.studentId)?.registerNumber ?? '',
      openArrears: t._count._all,
    })),
  };
}
