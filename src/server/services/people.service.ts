import crypto from 'node:crypto';
import type { AccountStatus, Gender, Prisma, RoomType, SubjectType } from '@prisma/client';

import { prisma } from '@/lib/db';
import { badRequest, conflict, forbidden, notFound } from '@/server/api/errors';
import { clamp } from '@/lib/utils';
import { hashPassword, passwordIssues } from '@/server/auth/password';
import { audit } from './audit.service';
import { notify } from './notification.service';
import { getSettings } from './settings.service';
import { countStatus } from './attendance.service';

/** Generate a one-time password and return it so the admin can share it. */
export function generateTemporaryPassword(seedText: string) {
  const base = crypto.createHash('sha256').update(`${seedText}:${Date.now()}`).digest('hex').slice(0, 6);
  return `Campus@${base.slice(0, 4).toUpperCase()}${Number.parseInt(base.slice(4, 6), 16) % 90 + 10}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Students
// ─────────────────────────────────────────────────────────────────────────

export interface StudentListFilter {
  search?: string;
  departmentId?: string;
  classId?: string;
  yearOfStudy?: number;
  section?: string;
  status?: AccountStatus;
  atRiskOnly?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'registerNumber' | 'name' | 'attendance' | 'cgpa';
  sortDir?: 'asc' | 'desc';
}

export async function listStudents(filter: StudentListFilter = {}) {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = clamp(filter.pageSize ?? 20, 1, 100);

  // At-risk students are decided by the configurable threshold, so the set of
  // ids is resolved first and pushed into the WHERE clause — that keeps the
  // pagination counts honest instead of filtering a single page after the fact.
  let atRiskIds: string[] | undefined;
  if (filter.atRiskOnly) {
    const { attendance: thresholds } = await getSettings();
    const grouped = await prisma.attendanceRecord.groupBy({
      by: ['studentId', 'status'],
      where: { session: { deletedAt: null } },
      _count: { _all: true },
    });
    const totals = new Map<string, { total: number; credited: number }>();
    for (const row of grouped) {
      const entry = totals.get(row.studentId) ?? { total: 0, credited: 0 };
      entry.total += row._count._all;
      entry.credited += countStatus(row.status, thresholds) * row._count._all;
      totals.set(row.studentId, entry);
    }
    atRiskIds = Array.from(totals.entries())
      .filter(([, t]) => t.total > 0 && (t.credited / t.total) * 100 < thresholds.safe)
      .map(([studentId]) => studentId);
    if (atRiskIds.length === 0) {
      return { items: [], meta: { page, pageSize, total: 0, totalPages: 1 } };
    }
  }

  const where: Prisma.StudentWhereInput = {
    deletedAt: null,
    ...(atRiskIds ? { id: { in: atRiskIds } } : {}),
    ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
    ...(filter.classId ? { classId: filter.classId } : {}),
    ...(filter.status ? { academicStatus: filter.status } : {}),
    ...(filter.section ? { class: { section: filter.section } } : {}),
    ...(filter.yearOfStudy ? { class: { yearOfStudy: filter.yearOfStudy } } : {}),
    ...(filter.search
      ? {
          OR: [
            { registerNumber: { contains: filter.search, mode: 'insensitive' } },
            { rollNumber: { contains: filter.search, mode: 'insensitive' } },
            { user: { firstName: { contains: filter.search, mode: 'insensitive' } } },
            { user: { lastName: { contains: filter.search, mode: 'insensitive' } } },
            { user: { email: { contains: filter.search, mode: 'insensitive' } } },
            { class: { name: { contains: filter.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.StudentOrderByWithRelationInput[] =
    filter.sortBy === 'name'
      ? [{ user: { firstName: filter.sortDir === 'desc' ? 'desc' : 'asc' } }]
      : filter.sortBy === 'cgpa'
        ? [{ cgpa: filter.sortDir === 'desc' ? 'desc' : 'asc' }]
        : [{ registerNumber: filter.sortDir === 'desc' ? 'desc' : 'asc' }];

  const [total, rows] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, status: true, lastLoginAt: true } },
        department: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, section: true, yearOfStudy: true } },
        _count: { select: { arrears: true } },
      },
    }),
  ]);

  const studentIds = rows.map((r) => r.id);
  const attendanceRows = await prisma.attendanceRecord.findMany({
    where: { studentId: { in: studentIds }, session: { deletedAt: null } },
    select: { studentId: true, status: true },
  });
  const byStudent = new Map<string, { total: number; present: number }>();
  for (const row of attendanceRows) {
    const entry = byStudent.get(row.studentId) ?? { total: 0, present: 0 };
    entry.total += 1;
    if (row.status !== 'ABSENT') entry.present += 1;
    byStudent.set(row.studentId, entry);
  }

  const items = rows.map((s) => {
    const att = byStudent.get(s.id);
    return {
      id: s.id,
      userId: s.user.id,
      registerNumber: s.registerNumber,
      rollNumber: s.rollNumber,
      firstName: s.user.firstName,
      lastName: s.user.lastName,
      name: `${s.user.firstName} ${s.user.lastName}`,
      email: s.user.email,
      departmentId: s.departmentId,
      departmentName: s.department.name,
      departmentCode: s.department.code,
      classId: s.classId,
      className: s.class?.name ?? null,
      section: s.class?.section ?? null,
      yearOfStudy: s.class?.yearOfStudy ?? null,
      semester: s.semester,
      cgpa: s.cgpa,
      academicStatus: s.academicStatus,
      openArrears: s._count.arrears,
      attendancePercentage: att && att.total ? Math.round((att.present / att.total) * 1000) / 10 : null,
      lastLoginAt: s.user.lastLoginAt?.toISOString() ?? null,
    };
  });

  return {
    items,
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function getStudentProfile(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, status: true, createdAt: true, lastLoginAt: true } },
      department: true,
      class: { include: { academicYear: true, classSubjects: { include: { subject: true } } } },
      enrollments: { include: { subject: true } },
      arrears: { where: { status: 'OPEN' }, include: { subject: true } },
      resumes: { where: { deletedAt: null }, take: 3, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!student || student.deletedAt) throw notFound('That student does not exist.');

  return {
    id: student.id,
    userId: student.user.id,
    registerNumber: student.registerNumber,
    rollNumber: student.rollNumber,
    firstName: student.user.firstName,
    lastName: student.user.lastName,
    email: student.user.email,
    phone: student.user.phone ?? student.guardianPhone,
    avatarUrl: student.user.avatarUrl,
    gender: student.gender,
    dateOfBirth: student.dateOfBirth?.toISOString() ?? null,
    address: student.address,
    city: student.city,
    guardianName: student.guardianName,
    guardianPhone: student.guardianPhone,
    bloodGroup: student.bloodGroup,
    batch: student.batch,
    admissionYear: student.admissionYear,
    semester: student.semester,
    cgpa: student.cgpa,
    academicStatus: student.academicStatus,
    department: { id: student.department.id, name: student.department.name, code: student.department.code },
    class: student.class
      ? {
          id: student.class.id,
          name: student.class.name,
          section: student.class.section,
          yearOfStudy: student.class.yearOfStudy,
          academicYear: student.class.academicYear.name,
        }
      : null,
    subjects: (student.class?.classSubjects ?? []).map((cs) => ({
      id: cs.subject.id,
      code: cs.subject.code,
      name: cs.subject.name,
      subjectType: cs.subject.subjectType,
      weeklyPeriods: cs.subject.weeklyPeriods,
      credits: cs.subject.credits,
    })),
    openArrears: student.arrears.map((a) => ({
      id: a.id,
      subjectId: a.subject.id,
      subjectCode: a.subject.code,
      subjectName: a.subject.name,
      semester: a.semester,
      attempts: a.attempts,
    })),
    resumeCount: student.resumes.length,
    joinedOn: student.user.createdAt.toISOString(),
    lastLoginAt: student.user.lastLoginAt?.toISOString() ?? null,
  };
}

export interface StudentInput {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  registerNumber: string;
  rollNumber?: string;
  departmentId: string;
  classId?: string | null;
  semester?: number;
  admissionYear?: number;
  gender?: Gender;
  dateOfBirth?: Date | null;
  phone?: string;
  address?: string;
  city?: string;
  guardianName?: string;
  guardianPhone?: string;
  bloodGroup?: string;
  batch?: string;
  cgpa?: number | null;
  academicStatus?: AccountStatus;
}

export async function createStudent(input: StudentInput, actorUserId: string) {
  const email = input.email.trim().toLowerCase();
  const registerNumber = input.registerNumber.trim().toUpperCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw badRequest('Enter a valid email address.');
  if (!registerNumber) throw badRequest('A register number is required.');

  const [existingEmail, existingRegister, department, klass] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.student.findUnique({ where: { registerNumber } }),
    prisma.department.findUnique({ where: { id: input.departmentId } }),
    input.classId
      ? prisma.class.findUnique({ where: { id: input.classId }, include: { academicYear: true } })
      : Promise.resolve(null),
  ]);

  if (existingEmail) throw conflict('That email address is already registered.');
  if (existingRegister) throw conflict(`Register number ${registerNumber} is already in use.`);
  if (!department || department.deletedAt) throw notFound('That department does not exist.');
  if (input.classId && !klass) throw notFound('That class does not exist.');

  const issues = input.password ? passwordIssues(input.password) : [];
  if (issues.length) throw badRequest(issues[0]);
  const temporaryPassword = input.password ?? generateTemporaryPassword(registerNumber);

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash: await hashPassword(temporaryPassword),
        role: 'STUDENT',
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone ?? null,
        status: 'ACTIVE',
      },
    });
    const student = await tx.student.create({
      data: {
        userId: user.id,
        registerNumber,
        rollNumber: input.rollNumber ?? null,
        departmentId: input.departmentId,
        classId: input.classId ?? null,
        semester: input.semester ?? klass?.semester ?? 1,
        admissionYear: input.admissionYear ?? klass?.academicYear?.startDate?.getUTCFullYear?.() ?? new Date().getFullYear(),
        gender: input.gender ?? 'UNSPECIFIED',
        dateOfBirth: input.dateOfBirth ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        guardianName: input.guardianName ?? null,
        guardianPhone: input.guardianPhone ?? null,
        bloodGroup: input.bloodGroup ?? null,
        batch: input.batch ?? null,
        cgpa: input.cgpa ?? null,
        academicStatus: input.academicStatus ?? 'ACTIVE',
      },
    });

    if (input.classId) {
      const subjects = await tx.classSubject.findMany({ where: { classId: input.classId } });
      const year = await tx.class.findUnique({ where: { id: input.classId }, select: { academicYearId: true } });
      await tx.enrollment.createMany({
        data: subjects.map((cs) => ({
          studentId: student.id,
          subjectId: cs.subjectId,
          classId: input.classId,
          academicYearId: year?.academicYearId ?? null,
          semester: input.semester ?? 1,
        })),
        skipDuplicates: true,
      });
    }
    return student;
  });

  audit({
    action: 'student.create',
    resourceType: 'Student',
    resourceId: created.id,
    description: `Created student ${registerNumber} (${input.firstName} ${input.lastName})`,
    newValue: { registerNumber, email, departmentId: input.departmentId },
    userId: actorUserId,
  });

  await notify(created.userId, {
    type: 'SYSTEM',
    title: 'Welcome to CampusIQ',
    message: `Your student account (${registerNumber}) has been created. Sign in and complete your profile.`,
    link: '/profile',
  }).catch(() => undefined);

  return { studentId: created.id, temporaryPassword: input.password ? undefined : temporaryPassword };
}

export async function updateStudent(studentId: string, patch: Partial<StudentInput> & { userId?: string }, actorUserId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { user: true },
  });
  if (!student || student.deletedAt) throw notFound('That student does not exist.');

  const data: Prisma.StudentUpdateInput = {};
  if (patch.registerNumber !== undefined) {
    const registerNumber = patch.registerNumber.trim().toUpperCase();
    const clash = await prisma.student.findUnique({ where: { registerNumber } });
    if (clash && clash.id !== studentId) throw conflict(`Register number ${registerNumber} is already in use.`);
    data.registerNumber = registerNumber;
  }
  if (patch.rollNumber !== undefined) data.rollNumber = patch.rollNumber;
  if (patch.semester !== undefined) data.semester = clamp(patch.semester, 1, 12);
  if (patch.gender !== undefined) data.gender = patch.gender;
  if (patch.dateOfBirth !== undefined) data.dateOfBirth = patch.dateOfBirth;
  if (patch.address !== undefined) data.address = patch.address;
  if (patch.city !== undefined) data.city = patch.city;
  if (patch.guardianName !== undefined) data.guardianName = patch.guardianName;
  if (patch.guardianPhone !== undefined) data.guardianPhone = patch.guardianPhone;
  if (patch.bloodGroup !== undefined) data.bloodGroup = patch.bloodGroup;
  if (patch.batch !== undefined) data.batch = patch.batch;
  if (patch.cgpa !== undefined) data.cgpa = patch.cgpa;
  if (patch.academicStatus !== undefined) data.academicStatus = patch.academicStatus;
  if (patch.departmentId !== undefined) {
    const dept = await prisma.department.findUnique({ where: { id: patch.departmentId } });
    if (!dept) throw notFound('That department does not exist.');
    data.department = { connect: { id: dept.id } };
  }
  if (patch.classId !== undefined) {
    if (patch.classId) {
      const klass = await prisma.class.findUnique({ where: { id: patch.classId } });
      if (!klass) throw notFound('That class does not exist.');
      data.class = { connect: { id: klass.id } };
    } else {
      data.class = { disconnect: true };
    }
  }

  const userData: Prisma.UserUpdateInput = {};
  if (patch.firstName !== undefined) userData.firstName = patch.firstName.trim();
  if (patch.lastName !== undefined) userData.lastName = patch.lastName.trim();
  if (patch.phone !== undefined) userData.phone = patch.phone;
  if (patch.email !== undefined) {
    const email = patch.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw badRequest('Enter a valid email address.');
    const clash = await prisma.user.findUnique({ where: { email } });
    if (clash && clash.id !== student.userId) throw conflict('That email address is already registered.');
    userData.email = email;
  }
  if (patch.password) {
    const issues = passwordIssues(patch.password);
    if (issues.length) throw badRequest(issues[0]);
    userData.passwordHash = await hashPassword(patch.password);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (Object.keys(userData).length > 0) await tx.user.update({ where: { id: student.userId }, data: userData });
    return tx.student.update({ where: { id: studentId }, data, include: { user: true } });
  });

  audit({
    action: 'student.update',
    resourceType: 'Student',
    resourceId: studentId,
    description: `Updated student ${updated.registerNumber}`,
    previousValue: { registerNumber: student.registerNumber, semester: student.semester, classId: student.classId },
    newValue: patch,
    userId: actorUserId,
  });

  return { studentId: updated.id };
}

export async function deleteStudent(studentId: string, actorUserId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { user: true } });
  if (!student) throw notFound('That student does not exist.');
  if (student.userId === actorUserId) throw forbidden('You cannot delete your own account.');

  await prisma.$transaction([
    prisma.student.update({ where: { id: studentId }, data: { deletedAt: new Date(), academicStatus: 'INACTIVE' } }),
    prisma.user.update({ where: { id: student.userId }, data: { deletedAt: new Date(), status: 'INACTIVE' } }),
    prisma.session.updateMany({ where: { userId: student.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  audit({
    action: 'student.delete',
    resourceType: 'Student',
    resourceId: studentId,
    description: `Deleted student ${student.registerNumber}`,
    previousValue: { registerNumber: student.registerNumber, email: student.user.email },
    userId: actorUserId,
  });
  return { deleted: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Faculty
// ─────────────────────────────────────────────────────────────────────────

export async function listFaculty(filter: { search?: string; departmentId?: string; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = clamp(filter.pageSize ?? 20, 1, 100);
  const where: Prisma.FacultyWhereInput = {
    deletedAt: null,
    ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
    ...(filter.search
      ? {
          OR: [
            { employeeId: { contains: filter.search, mode: 'insensitive' } },
            { designation: { contains: filter.search, mode: 'insensitive' } },
            { specialization: { contains: filter.search, mode: 'insensitive' } },
            { user: { firstName: { contains: filter.search, mode: 'insensitive' } } },
            { user: { lastName: { contains: filter.search, mode: 'insensitive' } } },
            { user: { email: { contains: filter.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.faculty.count({ where }),
    prisma.faculty.findMany({
      where,
      orderBy: { employeeId: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true, lastLoginAt: true } },
        department: { select: { id: true, name: true, code: true } },
        subjects: { include: { subject: { select: { id: true, code: true, name: true } } } },
        _count: { select: { attendanceSessions: true } },
      },
    }),
  ]);

  return {
    items: rows.map((f) => ({
      id: f.id,
      userId: f.user.id,
      employeeId: f.employeeId,
      name: `${f.user.firstName} ${f.user.lastName}`,
      firstName: f.user.firstName,
      lastName: f.user.lastName,
      email: f.user.email,
      phone: f.user.phone,
      designation: f.designation,
      specialization: f.specialization,
      qualification: f.qualification,
      experienceYears: f.experienceYears,
      departmentId: f.departmentId,
      departmentName: f.department.name,
      subjects: f.subjects.map((s) => ({ id: s.subject.id, code: s.subject.code, name: s.subject.name })),
      sessionCount: f._count.attendanceSessions,
      status: f.academicStatus,
      lastLoginAt: f.user.lastLoginAt?.toISOString() ?? null,
    })),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function getFacultyProfile(facultyId: string) {
  const faculty = await prisma.faculty.findUnique({
    where: { id: facultyId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, status: true } },
      department: true,
      subjects: { include: { subject: true } },
      headsDepartment: true,
    },
  });
  if (!faculty || faculty.deletedAt) throw notFound('That faculty member does not exist.');

  const classes = await prisma.classSubject.findMany({
    where: { subjectId: { in: faculty.subjects.map((s) => s.subjectId) } },
    include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, code: true, name: true } } },
  });

  return {
    id: faculty.id,
    userId: faculty.user.id,
    employeeId: faculty.employeeId,
    firstName: faculty.user.firstName,
    lastName: faculty.user.lastName,
    email: faculty.user.email,
    phone: faculty.user.phone,
    avatarUrl: faculty.user.avatarUrl,
    designation: faculty.designation,
    specialization: faculty.specialization,
    qualification: faculty.qualification,
    experienceYears: faculty.experienceYears,
    gender: faculty.gender,
    joinedOn: faculty.joinedOn?.toISOString() ?? null,
    status: faculty.academicStatus,
    department: { id: faculty.department.id, name: faculty.department.name, code: faculty.department.code },
    headsDepartments: faculty.headsDepartment.map((d) => d.name),
    subjects: faculty.subjects.map((s) => ({ id: s.subject.id, code: s.subject.code, name: s.subject.name, subjectType: s.subject.subjectType })),
    classes: classes.map((c) => ({ classId: c.classId, className: c.class.name, subjectId: c.subjectId, subjectName: c.subject.name })),
  };
}

export interface FacultyInput {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  employeeId: string;
  departmentId: string;
  designation?: string;
  specialization?: string;
  qualification?: string;
  experienceYears?: number;
  gender?: Gender;
  joinedOn?: Date | null;
  phone?: string;
  subjectIds?: string[];
  academicStatus?: AccountStatus;
}

export async function createFaculty(input: FacultyInput, actorUserId: string) {
  const email = input.email.trim().toLowerCase();
  const employeeId = input.employeeId.trim().toUpperCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw badRequest('Enter a valid email address.');
  if (!employeeId) throw badRequest('An employee ID is required.');

  const [existingEmail, existingEmployee, department] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.faculty.findUnique({ where: { employeeId } }),
    prisma.department.findUnique({ where: { id: input.departmentId } }),
  ]);
  if (existingEmail) throw conflict('That email address is already registered.');
  if (existingEmployee) throw conflict(`Employee ID ${employeeId} is already in use.`);
  if (!department || department.deletedAt) throw notFound('That department does not exist.');

  const issues = input.password ? passwordIssues(input.password) : [];
  if (issues.length) throw badRequest(issues[0]);
  const temporaryPassword = input.password ?? generateTemporaryPassword(employeeId);

  const faculty = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash: await hashPassword(temporaryPassword),
        role: 'FACULTY',
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        phone: input.phone ?? null,
        status: 'ACTIVE',
      },
    });
    const created = await tx.faculty.create({
      data: {
        userId: user.id,
        employeeId,
        departmentId: input.departmentId,
        designation: input.designation ?? 'Assistant Professor',
        specialization: input.specialization ?? null,
        qualification: input.qualification ?? null,
        experienceYears: input.experienceYears ?? 0,
        gender: input.gender ?? 'UNSPECIFIED',
        joinedOn: input.joinedOn ?? null,
        academicStatus: input.academicStatus ?? 'ACTIVE',
      },
    });
    if (input.subjectIds?.length) {
      await tx.facultySubject.createMany({
        data: input.subjectIds.map((subjectId) => ({ facultyId: created.id, subjectId })),
        skipDuplicates: true,
      });
    }
    return created;
  });

  audit({
    action: 'faculty.create',
    resourceType: 'Faculty',
    resourceId: faculty.id,
    description: `Created faculty ${employeeId} (${input.firstName} ${input.lastName})`,
    newValue: { employeeId, email, departmentId: input.departmentId },
    userId: actorUserId,
  });

  return { facultyId: faculty.id, temporaryPassword: input.password ? undefined : temporaryPassword };
}

export async function updateFaculty(facultyId: string, patch: Partial<FacultyInput>, actorUserId: string) {
  const faculty = await prisma.faculty.findUnique({ where: { id: facultyId }, include: { user: true } });
  if (!faculty || faculty.deletedAt) throw notFound('That faculty member does not exist.');

  const data: Prisma.FacultyUpdateInput = {};
  if (patch.employeeId !== undefined) {
    const employeeId = patch.employeeId.trim().toUpperCase();
    const clash = await prisma.faculty.findUnique({ where: { employeeId } });
    if (clash && clash.id !== facultyId) throw conflict(`Employee ID ${employeeId} is already in use.`);
    data.employeeId = employeeId;
  }
  if (patch.designation !== undefined) data.designation = patch.designation;
  if (patch.specialization !== undefined) data.specialization = patch.specialization;
  if (patch.qualification !== undefined) data.qualification = patch.qualification;
  if (patch.experienceYears !== undefined) data.experienceYears = clamp(patch.experienceYears, 0, 60);
  if (patch.gender !== undefined) data.gender = patch.gender;
  if (patch.joinedOn !== undefined) data.joinedOn = patch.joinedOn;
  if (patch.academicStatus !== undefined) data.academicStatus = patch.academicStatus;
  if (patch.departmentId !== undefined) {
    const dept = await prisma.department.findUnique({ where: { id: patch.departmentId } });
    if (!dept) throw notFound('That department does not exist.');
    data.department = { connect: { id: dept.id } };
  }

  const userData: Prisma.UserUpdateInput = {};
  if (patch.firstName !== undefined) userData.firstName = patch.firstName.trim();
  if (patch.lastName !== undefined) userData.lastName = patch.lastName.trim();
  if (patch.phone !== undefined) userData.phone = patch.phone;
  if (patch.email !== undefined) {
    const email = patch.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw badRequest('Enter a valid email address.');
    const clash = await prisma.user.findUnique({ where: { email } });
    if (clash && clash.id !== faculty.userId) throw conflict('That email address is already registered.');
    userData.email = email;
  }
  if (patch.password) {
    const issues = passwordIssues(patch.password);
    if (issues.length) throw badRequest(issues[0]);
    userData.passwordHash = await hashPassword(patch.password);
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userData).length) await tx.user.update({ where: { id: faculty.userId }, data: userData });
    await tx.faculty.update({ where: { id: facultyId }, data });
    if (patch.subjectIds) {
      await tx.facultySubject.deleteMany({ where: { facultyId } });
      if (patch.subjectIds.length) {
        await tx.facultySubject.createMany({
          data: patch.subjectIds.map((subjectId) => ({ facultyId, subjectId })),
          skipDuplicates: true,
        });
      }
    }
  });

  audit({
    action: 'faculty.update',
    resourceType: 'Faculty',
    resourceId: facultyId,
    description: `Updated faculty ${faculty.employeeId}`,
    previousValue: { designation: faculty.designation, departmentId: faculty.departmentId },
    newValue: patch,
    userId: actorUserId,
  });
  return { facultyId };
}

export async function deleteFaculty(facultyId: string, actorUserId: string) {
  const faculty = await prisma.faculty.findUnique({ where: { id: facultyId }, include: { user: true } });
  if (!faculty) throw notFound('That faculty member does not exist.');
  if (faculty.userId === actorUserId) throw forbidden('You cannot delete your own account.');

  await prisma.$transaction([
    prisma.faculty.update({ where: { id: facultyId }, data: { deletedAt: new Date(), academicStatus: 'INACTIVE' } }),
    prisma.user.update({ where: { id: faculty.userId }, data: { deletedAt: new Date(), status: 'INACTIVE' } }),
    prisma.session.updateMany({ where: { userId: faculty.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  audit({
    action: 'faculty.delete',
    resourceType: 'Faculty',
    resourceId: facultyId,
    description: `Deleted faculty ${faculty.employeeId}`,
    previousValue: { employeeId: faculty.employeeId },
    userId: actorUserId,
  });
  return { deleted: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Academic structure
// ─────────────────────────────────────────────────────────────────────────

export async function listDepartments() {
  const rows = await prisma.department.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    include: {
      headOfDepartment: { include: { user: { select: { firstName: true, lastName: true } } } },
      _count: { select: { students: true, faculty: true, subjects: true, classes: true } },
    },
  });
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code,
    description: d.description,
    building: d.building,
    headOfDepartment: d.headOfDepartment
      ? { id: d.headOfDepartment.id, name: `${d.headOfDepartment.user.firstName} ${d.headOfDepartment.user.lastName}` }
      : null,
    studentCount: d._count.students,
    facultyCount: d._count.faculty,
    subjectCount: d._count.subjects,
    classCount: d._count.classes,
  }));
}

export async function createDepartment(input: { name: string; code: string; description?: string; building?: string; headOfDepartmentId?: string | null }, actorUserId: string) {
  const name = input.name.trim();
  const code = input.code.trim().toUpperCase();
  if (!name || !code) throw badRequest('Department name and code are required.');
  const clash = await prisma.department.findFirst({ where: { OR: [{ name }, { code }] } });
  if (clash) throw conflict('A department with that name or code already exists.');

  const department = await prisma.department.create({
    data: { name, code, description: input.description ?? null, building: input.building ?? null, headOfDepartmentId: input.headOfDepartmentId ?? null },
  });
  audit({ action: 'department.create', resourceType: 'Department', resourceId: department.id, description: `Created department ${code}`, newValue: { name, code }, userId: actorUserId });
  return department;
}

export async function updateDepartment(id: string, patch: { name?: string; code?: string; description?: string; building?: string; headOfDepartmentId?: string | null }, actorUserId: string) {
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) throw notFound('That department does not exist.');
  const updated = await prisma.department.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.code !== undefined ? { code: patch.code.trim().toUpperCase() } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.building !== undefined ? { building: patch.building } : {}),
      ...(patch.headOfDepartmentId !== undefined ? { headOfDepartmentId: patch.headOfDepartmentId } : {}),
    },
  });
  audit({ action: 'department.update', resourceType: 'Department', resourceId: id, description: `Updated department ${updated.code}`, previousValue: existing, newValue: patch, userId: actorUserId });
  return updated;
}

export async function deleteDepartment(id: string, actorUserId: string) {
  const [students, faculty, subjects] = await Promise.all([
    prisma.student.count({ where: { departmentId: id, deletedAt: null } }),
    prisma.faculty.count({ where: { departmentId: id, deletedAt: null } }),
    prisma.subject.count({ where: { departmentId: id, deletedAt: null } }),
  ]);
  if (students + faculty + subjects > 0) {
    throw conflict(`This department still has ${students} student(s), ${faculty} faculty and ${subjects} subject(s). Move them first.`);
  }
  await prisma.department.update({ where: { id }, data: { deletedAt: new Date() } });
  audit({ action: 'department.delete', resourceType: 'Department', resourceId: id, description: 'Deleted a department', userId: actorUserId });
  return { deleted: true };
}

export async function listSubjects(filter: { departmentId?: string; semester?: number; search?: string; subjectType?: SubjectType } = {}) {
  const rows = await prisma.subject.findMany({
    where: {
      deletedAt: null,
      ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
      ...(filter.semester ? { semester: filter.semester } : {}),
      ...(filter.subjectType ? { subjectType: filter.subjectType } : {}),
      ...(filter.search
        ? { OR: [{ name: { contains: filter.search, mode: 'insensitive' } }, { code: { contains: filter.search, mode: 'insensitive' } }] }
        : {}),
    },
    orderBy: [{ semester: 'asc' }, { code: 'asc' }],
    include: {
      department: { select: { id: true, name: true, code: true } },
      facultyAssignments: { include: { faculty: { include: { user: { select: { firstName: true, lastName: true } } } } } },
      _count: { select: { classSubjects: true } },
    },
  });
  return rows.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    shortName: s.shortName,
    subjectType: s.subjectType,
    semester: s.semester,
    credits: s.credits,
    weeklyPeriods: s.weeklyPeriods,
    periodsPerSession: s.periodsPerSession,
    maxIaMarks: s.maxIaMarks,
    maxTheoryMarks: s.maxTheoryMarks,
    passMarks: s.passMarks,
    departmentId: s.departmentId,
    departmentName: s.department.name,
    classCount: s._count.classSubjects,
    faculty: s.facultyAssignments.map((f) => ({
      id: f.faculty.id,
      name: `${f.faculty.user.firstName} ${f.faculty.user.lastName}`,
      classId: f.classId,
    })),
  }));
}

export interface SubjectInput {
  code: string;
  name: string;
  shortName?: string;
  description?: string;
  departmentId: string;
  subjectType?: SubjectType;
  semester?: number;
  credits?: number;
  weeklyPeriods?: number;
  periodsPerSession?: number;
  maxIaMarks?: number;
  maxTheoryMarks?: number;
  passMarks?: number;
}

export async function createSubject(input: SubjectInput, actorUserId: string) {
  const code = input.code.trim().toUpperCase();
  if (!code || !input.name.trim()) throw badRequest('Subject code and name are required.');
  const clash = await prisma.subject.findUnique({ where: { code } });
  if (clash) throw conflict(`Subject code ${code} already exists.`);
  const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
  if (!department) throw notFound('That department does not exist.');

  const subject = await prisma.subject.create({
    data: {
      code,
      name: input.name.trim(),
      shortName: input.shortName ?? null,
      description: input.description ?? null,
      departmentId: input.departmentId,
      subjectType: input.subjectType ?? 'THEORY',
      semester: clamp(input.semester ?? 1, 1, 12),
      credits: input.credits ?? 3,
      weeklyPeriods: clamp(input.weeklyPeriods ?? 4, 0, 20),
      periodsPerSession: clamp(input.periodsPerSession ?? 1, 1, 4),
      maxIaMarks: input.maxIaMarks ?? 50,
      maxTheoryMarks: input.maxTheoryMarks ?? 100,
      passMarks: input.passMarks ?? 50,
    },
  });
  audit({ action: 'subject.create', resourceType: 'Subject', resourceId: subject.id, description: `Created subject ${code}`, newValue: input, userId: actorUserId });
  return subject;
}

export async function updateSubject(id: string, patch: Partial<SubjectInput>, actorUserId: string) {
  const existing = await prisma.subject.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw notFound('That subject does not exist.');
  if (patch.code) {
    const code = patch.code.trim().toUpperCase();
    const clash = await prisma.subject.findUnique({ where: { code } });
    if (clash && clash.id !== id) throw conflict(`Subject code ${code} already exists.`);
    patch = { ...patch, code };
  }
  const updated = await prisma.subject.update({
    where: { id },
    data: {
      ...(patch.code !== undefined ? { code: patch.code } : {}),
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.shortName !== undefined ? { shortName: patch.shortName } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.subjectType !== undefined ? { subjectType: patch.subjectType } : {}),
      ...(patch.semester !== undefined ? { semester: clamp(patch.semester, 1, 12) } : {}),
      ...(patch.credits !== undefined ? { credits: patch.credits } : {}),
      ...(patch.weeklyPeriods !== undefined ? { weeklyPeriods: clamp(patch.weeklyPeriods, 0, 20) } : {}),
      ...(patch.periodsPerSession !== undefined ? { periodsPerSession: clamp(patch.periodsPerSession, 1, 4) } : {}),
      ...(patch.maxIaMarks !== undefined ? { maxIaMarks: patch.maxIaMarks } : {}),
      ...(patch.maxTheoryMarks !== undefined ? { maxTheoryMarks: patch.maxTheoryMarks } : {}),
      ...(patch.passMarks !== undefined ? { passMarks: patch.passMarks } : {}),
      ...(patch.departmentId !== undefined ? { departmentId: patch.departmentId } : {}),
    },
  });
  audit({ action: 'subject.update', resourceType: 'Subject', resourceId: id, description: `Updated subject ${updated.code}`, previousValue: existing, newValue: patch, userId: actorUserId });
  return updated;
}

export async function deleteSubject(id: string, actorUserId: string) {
  const subject = await prisma.subject.findUnique({ where: { id }, include: { _count: { select: { classSubjects: true, attendanceSessions: true } } } });
  if (!subject) throw notFound('That subject does not exist.');
  if (subject._count.attendanceSessions > 0) {
    throw conflict(`${subject.code} has attendance history and cannot be deleted. Deactivate it instead.`);
  }
  await prisma.subject.update({ where: { id }, data: { deletedAt: new Date() } });
  audit({ action: 'subject.delete', resourceType: 'Subject', resourceId: id, description: `Deleted subject ${subject.code}`, userId: actorUserId });
  return { deleted: true };
}

export async function listClasses(filter: { departmentId?: string; academicYearId?: string; yearOfStudy?: number } = {}) {
  const rows = await prisma.class.findMany({
    where: {
      deletedAt: null,
      ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
      ...(filter.academicYearId ? { academicYearId: filter.academicYearId } : {}),
      ...(filter.yearOfStudy ? { yearOfStudy: filter.yearOfStudy } : {}),
    },
    orderBy: [{ yearOfStudy: 'asc' }, { section: 'asc' }],
    include: {
      department: { select: { id: true, name: true, code: true } },
      academicYear: { select: { id: true, name: true } },
      classSubjects: { include: { subject: { select: { id: true, code: true, name: true, weeklyPeriods: true, subjectType: true } } } },
      _count: { select: { students: true, timetables: true } },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    yearOfStudy: c.yearOfStudy,
    section: c.section,
    semester: c.semester,
    departmentId: c.departmentId,
    departmentName: c.department.name,
    academicYearId: c.academicYearId,
    academicYearName: c.academicYear.name,
    studentCount: c._count.students,
    timetableCount: c._count.timetables,
    subjects: c.classSubjects.map((cs) => ({
      id: cs.subject.id,
      code: cs.subject.code,
      name: cs.subject.name,
      weeklyPeriods: cs.subject.weeklyPeriods,
      subjectType: cs.subject.subjectType,
    })),
    weeklyPeriodTotal: c.classSubjects.reduce((a, cs) => a + cs.subject.weeklyPeriods, 0),
  }));
}

export async function createClass(
  input: { departmentId: string; academicYearId: string; yearOfStudy: number; section: string; semester?: number; subjectIds?: string[] },
  actorUserId: string,
) {
  const section = input.section.trim().toUpperCase();
  if (!section) throw badRequest('A section is required.');
  const clash = await prisma.class.findFirst({
    where: { departmentId: input.departmentId, academicYearId: input.academicYearId, yearOfStudy: input.yearOfStudy, section },
  });
  if (clash) throw conflict('That class and section already exists for this academic year.');

  const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
  const year = await prisma.academicYear.findUnique({ where: { id: input.academicYearId } });
  if (!department) throw notFound('That department does not exist.');
  if (!year) throw notFound('That academic year does not exist.');

  const klass = await prisma.class.create({
    data: {
      name: `${department.code} · Year ${input.yearOfStudy} · Section ${section}`,
      departmentId: input.departmentId,
      academicYearId: input.academicYearId,
      yearOfStudy: input.yearOfStudy,
      section,
      semester: input.semester ?? (input.yearOfStudy - 1) * 2 + 1,
      classSubjects: input.subjectIds?.length
        ? { create: input.subjectIds.map((subjectId) => ({ subjectId })) }
        : undefined,
    },
  });
  audit({ action: 'class.create', resourceType: 'Class', resourceId: klass.id, description: `Created class ${klass.name}`, newValue: input, userId: actorUserId });
  return klass;
}

export async function updateClass(id: string, patch: { semester?: number; section?: string; yearOfStudy?: number; subjectIds?: string[] }, actorUserId: string) {
  const existing = await prisma.class.findUnique({ where: { id }, include: { classSubjects: true } });
  if (!existing || existing.deletedAt) throw notFound('That class does not exist.');

  await prisma.$transaction(async (tx) => {
    await tx.class.update({
      where: { id },
      data: {
        ...(patch.semester !== undefined ? { semester: patch.semester } : {}),
        ...(patch.section !== undefined ? { section: patch.section.trim().toUpperCase() } : {}),
        ...(patch.yearOfStudy !== undefined ? { yearOfStudy: patch.yearOfStudy } : {}),
      },
    });
    if (patch.subjectIds) {
      const current = new Set(existing.classSubjects.map((cs) => cs.subjectId));
      const next = new Set(patch.subjectIds);
      const toRemove = Array.from(current).filter((s) => !next.has(s));
      const toAdd = Array.from(next).filter((s) => !current.has(s));
      if (toRemove.length) await tx.classSubject.deleteMany({ where: { classId: id, subjectId: { in: toRemove } } });
      if (toAdd.length) await tx.classSubject.createMany({ data: toAdd.map((subjectId) => ({ classId: id, subjectId })) });
      // Keep enrolments in step with the class curriculum.
      const students = await tx.student.findMany({ where: { classId: id, deletedAt: null }, select: { id: true, semester: true } });
      if (toAdd.length && students.length) {
        await tx.enrollment.createMany({
          data: students.flatMap((s) => toAdd.map((subjectId) => ({ studentId: s.id, subjectId, classId: id, academicYearId: existing.academicYearId, semester: s.semester }))),
          skipDuplicates: true,
        });
      }
    }
  });

  audit({ action: 'class.update', resourceType: 'Class', resourceId: id, description: `Updated class ${existing.name}`, previousValue: { semester: existing.semester }, newValue: patch, userId: actorUserId });
  return { classId: id };
}

export async function deleteClass(id: string, actorUserId: string) {
  const klass = await prisma.class.findUnique({ where: { id }, include: { _count: { select: { students: true } } } });
  if (!klass) throw notFound('That class does not exist.');
  if (klass._count.students > 0) throw conflict(`Move the ${klass._count.students} student(s) in ${klass.name} before deleting it.`);
  await prisma.class.update({ where: { id }, data: { deletedAt: new Date() } });
  audit({ action: 'class.delete', resourceType: 'Class', resourceId: id, description: `Deleted class ${klass.name}`, userId: actorUserId });
  return { deleted: true };
}

export async function listAcademicYears() {
  return prisma.academicYear.findMany({ orderBy: { startDate: 'desc' } });
}

export async function createAcademicYear(input: { name: string; startDate: Date; endDate: Date; isCurrent?: boolean; departmentId?: string | null }, actorUserId: string) {
  const clash = await prisma.academicYear.findUnique({ where: { name: input.name.trim() } });
  if (clash) throw conflict('That academic year already exists.');
  if (input.endDate <= input.startDate) throw badRequest('The end date must be after the start date.');

  const year = await prisma.$transaction(async (tx) => {
    if (input.isCurrent) await tx.academicYear.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
    return tx.academicYear.create({
      data: {
        name: input.name.trim(),
        startDate: input.startDate,
        endDate: input.endDate,
        isCurrent: input.isCurrent ?? false,
        departmentId: input.departmentId ?? null,
      },
    });
  });
  audit({ action: 'academicYear.create', resourceType: 'AcademicYear', resourceId: year.id, description: `Created academic year ${year.name}`, newValue: input, userId: actorUserId });
  return year;
}

export async function setCurrentAcademicYear(id: string, actorUserId: string) {
  const year = await prisma.academicYear.findUnique({ where: { id } });
  if (!year) throw notFound('That academic year does not exist.');
  await prisma.$transaction([
    prisma.academicYear.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } }),
    prisma.academicYear.update({ where: { id }, data: { isCurrent: true } }),
  ]);
  audit({ action: 'academicYear.setCurrent', resourceType: 'AcademicYear', resourceId: id, description: `Set ${year.name} as the current academic year`, userId: actorUserId });
  return { id, isCurrent: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Rooms & laboratories
// ─────────────────────────────────────────────────────────────────────────

export async function listRooms(filter: { roomType?: RoomType; departmentId?: string; search?: string } = {}) {
  const rows = await prisma.room.findMany({
    where: {
      deletedAt: null,
      ...(filter.roomType ? { roomType: filter.roomType } : {}),
      ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
      ...(filter.search ? { OR: [{ name: { contains: filter.search, mode: 'insensitive' } }, { code: { contains: filter.search, mode: 'insensitive' } }] } : {}),
    },
    orderBy: { code: 'asc' },
    include: { department: { select: { id: true, name: true } }, laboratory: { select: { id: true, name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    capacity: r.capacity,
    roomType: r.roomType,
    building: r.building,
    floor: r.floor,
    hasProjector: r.hasProjector,
    departmentId: r.departmentId,
    departmentName: r.department?.name ?? null,
    laboratoryId: r.laboratoryId,
    laboratoryName: r.laboratory?.name ?? null,
  }));
}

export async function createRoom(
  input: { code: string; name: string; capacity: number; roomType?: RoomType; building?: string; floor?: number; hasProjector?: boolean; departmentId?: string | null; laboratoryId?: string | null },
  actorUserId: string,
) {
  const code = input.code.trim().toUpperCase();
  if (!code) throw badRequest('A room code is required.');
  if (input.capacity <= 0) throw badRequest('Capacity must be greater than zero.');
  const clash = await prisma.room.findUnique({ where: { code } });
  if (clash) throw conflict(`Room ${code} already exists.`);

  const room = await prisma.room.create({
    data: {
      code,
      name: input.name.trim(),
      capacity: input.capacity,
      roomType: input.roomType ?? 'CLASSROOM',
      building: input.building ?? null,
      floor: input.floor ?? null,
      hasProjector: input.hasProjector ?? false,
      departmentId: input.departmentId ?? null,
      laboratoryId: input.laboratoryId ?? null,
    },
  });
  audit({ action: 'room.create', resourceType: 'Room', resourceId: room.id, description: `Created room ${code}`, newValue: input, userId: actorUserId });
  return room;
}

export async function updateRoom(id: string, patch: Parameters<typeof createRoom>[0], actorUserId: string) {
  const existing = await prisma.room.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw notFound('That room does not exist.');
  const updated = await prisma.room.update({
    where: { id },
    data: {
      ...(patch.code !== undefined ? { code: patch.code.trim().toUpperCase() } : {}),
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.capacity !== undefined ? { capacity: patch.capacity } : {}),
      ...(patch.roomType !== undefined ? { roomType: patch.roomType } : {}),
      ...(patch.building !== undefined ? { building: patch.building } : {}),
      ...(patch.floor !== undefined ? { floor: patch.floor } : {}),
      ...(patch.hasProjector !== undefined ? { hasProjector: patch.hasProjector } : {}),
      ...(patch.departmentId !== undefined ? { departmentId: patch.departmentId } : {}),
      ...(patch.laboratoryId !== undefined ? { laboratoryId: patch.laboratoryId } : {}),
    },
  });
  audit({ action: 'room.update', resourceType: 'Room', resourceId: id, description: `Updated room ${updated.code}`, previousValue: existing, newValue: patch, userId: actorUserId });
  return updated;
}

export async function deleteRoom(id: string, actorUserId: string) {
  const room = await prisma.room.findUnique({ where: { id }, include: { _count: { select: { timetableSlots: true } } } });
  if (!room) throw notFound('That room does not exist.');
  if (room._count.timetableSlots > 0) throw conflict(`${room.code} is used in ${room._count.timetableSlots} timetable slot(s) and cannot be deleted.`);
  await prisma.room.update({ where: { id }, data: { deletedAt: new Date() } });
  audit({ action: 'room.delete', resourceType: 'Room', resourceId: id, description: `Deleted room ${room.code}`, userId: actorUserId });
  return { deleted: true };
}

export async function listLaboratories(filter: { departmentId?: string } = {}) {
  const rows = await prisma.laboratory.findMany({
    where: { deletedAt: null, ...(filter.departmentId ? { departmentId: filter.departmentId } : {}) },
    orderBy: { name: 'asc' },
    include: { department: { select: { id: true, name: true } }, rooms: { select: { id: true, code: true } } },
  });
  return rows.map((l) => ({
    id: l.id,
    name: l.name,
    code: l.code,
    capacity: l.capacity,
    equipment: l.equipment,
    departmentId: l.departmentId,
    departmentName: l.department.name,
    rooms: l.rooms,
  }));
}

export async function createLaboratory(input: { name: string; code: string; capacity: number; equipment?: string; departmentId: string }, actorUserId: string) {
  const code = input.code.trim().toUpperCase();
  const clash = await prisma.laboratory.findUnique({ where: { code } });
  if (clash) throw conflict(`Laboratory ${code} already exists.`);
  const lab = await prisma.laboratory.create({
    data: { name: input.name.trim(), code, capacity: input.capacity, equipment: input.equipment ?? null, departmentId: input.departmentId },
  });
  audit({ action: 'laboratory.create', resourceType: 'Laboratory', resourceId: lab.id, description: `Created laboratory ${code}`, newValue: input, userId: actorUserId });
  return lab;
}

export async function deleteLaboratory(id: string, actorUserId: string) {
  const lab = await prisma.laboratory.findUnique({ where: { id }, include: { _count: { select: { timetableSlots: true } } } });
  if (!lab) throw notFound('That laboratory does not exist.');
  if (lab._count.timetableSlots > 0) throw conflict(`${lab.name} appears in active timetables and cannot be deleted.`);
  await prisma.laboratory.update({ where: { id }, data: { deletedAt: new Date() } });
  audit({ action: 'laboratory.delete', resourceType: 'Laboratory', resourceId: id, description: `Deleted laboratory ${lab.name}`, userId: actorUserId });
  return { deleted: true };
}
