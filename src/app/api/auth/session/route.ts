import { apiHandler, ok } from '@/server/api/handler';
import { can } from '@/lib/permissions';
import { navigationDtoFor, mobileNavDtoFor } from '@/lib/navigation';
import { describeAiProvider } from '@/lib/ai';
import { getSettings } from '@/server/services/settings.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ user }) => {
  const { institution, attendance, academic } = await getSettings();
  return ok({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      themePreference: user.themePreference,
      studentId: user.studentId ?? null,
      facultyId: user.facultyId ?? null,
      registerNumber: user.registerNumber ?? null,
      employeeId: user.employeeId ?? null,
      departmentId: user.departmentId ?? null,
      departmentName: user.departmentName ?? null,
      classId: user.classId ?? null,
      className: user.className ?? null,
    },
    navigation: navigationDtoFor(user.role),
    mobileNavigation: mobileNavDtoFor(user.role),
    capabilities: {
      manageStudents: can(user.role, 'students.manage'),
      manageFaculty: can(user.role, 'faculty.manage'),
      manageSubjects: can(user.role, 'subjects.manage'),
      manageClasses: can(user.role, 'classes.manage'),
      manageRooms: can(user.role, 'rooms.manage'),
      manageDepartments: can(user.role, 'departments.manage'),
      manageSettings: can(user.role, 'settings.manage'),
      markAttendance: can(user.role, 'attendance.mark'),
      enterMarks: can(user.role, 'marks.enter'),
      uploadResults: can(user.role, 'results.upload'),
      generateTimetable: can(user.role, 'timetable.generate'),
      viewAudit: can(user.role, 'audit.view'),
      viewAnalytics: can(user.role, 'analytics.view'),
    },
    institution,
    thresholds: attendance,
    academic,
    ai: describeAiProvider(),
  });
});
