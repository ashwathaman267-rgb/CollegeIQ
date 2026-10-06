import { apiHandler, ok } from '@/server/api/handler';
import { listSessions, updateProfile } from '@/server/services/auth.service';
import { profileSchema } from '@/validations';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ user }) => {
  const [record, sessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      include: {
        student: { include: { department: true, class: true } },
        faculty: { include: { department: true } },
      },
    }),
    listSessions(user),
  ]);

  return ok({
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: record?.phone ?? null,
    avatarUrl: user.avatarUrl,
    themePreference: user.themePreference,
    status: user.status,
    student: record?.student
      ? {
          id: record.student.id,
          registerNumber: record.student.registerNumber,
          rollNumber: record.student.rollNumber,
          semester: record.student.semester,
          cgpa: record.student.cgpa,
          departmentName: record.student.department.name,
          className: record.student.class?.name ?? null,
          address: record.student.address,
          city: record.student.city,
          guardianName: record.student.guardianName,
          guardianPhone: record.student.guardianPhone,
        }
      : null,
    faculty: record?.faculty
      ? {
          id: record.faculty.id,
          employeeId: record.faculty.employeeId,
          designation: record.faculty.designation,
          specialization: record.faculty.specialization,
          experienceYears: record.faculty.experienceYears,
          departmentName: record.faculty.department.name,
        }
      : null,
    sessions,
  });
});

export const PATCH = apiHandler(async ({ user, body }) => ok(await updateProfile(user, profileSchema.parse(body))));
