import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';

import { getAuthUser, type AuthenticatedUser } from './session';
import { forbidden, unauthorized } from '@/server/api/errors';

/** Server-component guard: sends anonymous visitors to the login screen. */
export async function requireUser(nextPath?: string): Promise<AuthenticatedUser> {
  const user = await getAuthUser();
  if (!user) {
    const target = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';
    redirect(target);
  }
  return user;
}

export async function requireRole(roles: Role[], nextPath?: string): Promise<AuthenticatedUser> {
  const user = await requireUser(nextPath);
  if (!roles.includes(user.role)) redirect('/dashboard');
  return user;
}

export async function requireStudent(nextPath?: string) {
  const user = await requireRole(['STUDENT'], nextPath);
  if (!user.studentId) redirect('/profile');
  return user as AuthenticatedUser & { studentId: string };
}

export async function requireFacultyUser(nextPath?: string) {
  const user = await requireRole(['FACULTY'], nextPath);
  if (!user.facultyId) redirect('/profile');
  return user as AuthenticatedUser & { facultyId: string };
}

export async function requireAdmin(nextPath?: string) {
  return requireRole(['ADMIN'], nextPath);
}

/** API-side guards (throw instead of redirect). */
export function assertRole(user: AuthenticatedUser, roles: Role[]) {
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}

export function assertStudentProfile(user: AuthenticatedUser) {
  if (!user.studentId) throw forbidden('A student profile is required for this action.');
  return { ...user, studentId: user.studentId };
}

export function assertFacultyProfile(user: AuthenticatedUser) {
  if (!user.facultyId) throw forbidden('A faculty profile is required for this action.');
  return { ...user, facultyId: user.facultyId };
}

/**
 * A student may only ever read their own record. Faculty may read the students
 * of classes they teach; admins may read anything.
 */
export function canViewStudent(user: AuthenticatedUser, studentUserId: string) {
  return user.role === 'ADMIN' || user.id === studentUserId;
}

export { unauthorized };
