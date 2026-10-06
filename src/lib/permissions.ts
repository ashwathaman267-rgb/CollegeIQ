import type { Role } from '@prisma/client';

/**
 * Single source of truth for "who may do what".
 * The UI uses it to hide actions the user cannot perform; every API route
 * independently enforces the same rule server-side.
 */
export type Capability =
  | 'attendance.mark'
  | 'attendance.viewAll'
  | 'attendance.viewOwn'
  | 'marks.enter'
  | 'marks.viewAll'
  | 'results.upload'
  | 'results.viewAll'
  | 'timetable.generate'
  | 'timetable.edit'
  | 'timetable.viewAll'
  | 'students.manage'
  | 'faculty.manage'
  | 'subjects.manage'
  | 'classes.manage'
  | 'rooms.manage'
  | 'departments.manage'
  | 'settings.manage'
  | 'audit.view'
  | 'analytics.view'
  | 'career.use'
  | 'profile.manage';

const ADMIN: Capability[] = [
  'attendance.mark',
  'attendance.viewAll',
  'attendance.viewOwn',
  'marks.enter',
  'marks.viewAll',
  'results.upload',
  'results.viewAll',
  'timetable.generate',
  'timetable.edit',
  'timetable.viewAll',
  'students.manage',
  'faculty.manage',
  'subjects.manage',
  'classes.manage',
  'rooms.manage',
  'departments.manage',
  'settings.manage',
  'audit.view',
  'analytics.view',
  'career.use',
  'profile.manage',
];

const FACULTY: Capability[] = [
  'attendance.mark',
  'attendance.viewAll',
  'marks.enter',
  'marks.viewAll',
  'results.upload',
  'results.viewAll',
  'timetable.generate',
  'timetable.edit',
  'timetable.viewAll',
  'analytics.view',
  'career.use',
  'profile.manage',
];

const STUDENT: Capability[] = ['attendance.viewOwn', 'career.use', 'profile.manage'];

const MATRIX: Record<Role, Capability[]> = { ADMIN, FACULTY, STUDENT };

export function can(role: Role | undefined | null, capability: Capability): boolean {
  if (!role) return false;
  return MATRIX[role]?.includes(capability) ?? false;
}

export function canAny(role: Role | undefined | null, capabilities: Capability[]): boolean {
  return capabilities.some((c) => can(role, c));
}

export const ROLE_LABEL: Record<Role, string> = {
  STUDENT: 'Student',
  FACULTY: 'Faculty',
  ADMIN: 'Administrator',
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  STUDENT: 'Track attendance, academics, results and career readiness.',
  FACULTY: 'Mark attendance, enter IA marks, publish results and build timetables.',
  ADMIN: 'Full control over people, academic structure, analytics and settings.',
};

export const ALL_ROLES: Role[] = ['STUDENT', 'FACULTY', 'ADMIN'];
