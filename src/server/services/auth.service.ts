import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { badRequest, forbidden, notFound, unauthorized } from '@/server/api/errors';
import { hashPassword, passwordIssues, verifyPassword } from '@/server/auth/password';
import {
  createSession,
  destroyOtherSessions,
  destroySession,
  hashResetToken,
  newResetToken,
  requestMeta,
  type AuthenticatedUser,
} from '@/server/auth/session';
import { audit } from './audit.service';
import { notify } from './notification.service';

/**
 * Authentication + account lifecycle. Passwords are bcrypt-hashed, sessions are
 * opaque rows keyed by a hashed token and mirrored in a short-lived signed JWT
 * cookie, and every sensitive action lands in the audit log.
 */

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
export const RESET_TOKEN_TTL_MINUTES = 60;

export interface LoginResult {
  userId: string;
  role: AuthenticatedUser['role'];
  firstName: string;
  lastName: string;
  email: string;
  sessionId: string;
  themePreference: string;
  studentId?: string | null;
  facultyId?: string | null;
}

export async function login(input: { email: string; password: string }): Promise<LoginResult> {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: { student: { select: { id: true, deletedAt: true } }, faculty: { select: { id: true, deletedAt: true } } },
  });

  const { ip } = requestMeta();

  if (!user || user.deletedAt) {
    await audit({ action: 'auth.login.failed', resourceType: 'User', description: `Failed sign-in attempt for unknown account ${email}`, ipAddress: ip });
    throw unauthorized('Those credentials do not match an account.');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw forbidden(`This account is temporarily locked after repeated failed sign-ins. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`);
  }

  if (user.status === 'SUSPENDED') throw forbidden('This account is suspended. Contact your administrator.');
  if (user.status === 'INACTIVE') throw forbidden('This account is inactive. Contact your administrator.');

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    const failed = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failed,
        ...(failed >= MAX_FAILED_LOGINS ? { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000), failedLoginCount: 0 } : {}),
      },
    });
    await audit({
      action: 'auth.login.failed',
      resourceType: 'User',
      resourceId: user.id,
      description: `Failed sign-in for ${email}`,
      ipAddress: ip,
    });
    if (failed >= MAX_FAILED_LOGINS) {
      throw forbidden(`Too many failed attempts. This account is locked for ${LOCK_MINUTES} minutes.`);
    }
    throw unauthorized(`Those credentials do not match an account. ${MAX_FAILED_LOGINS - failed} attempt${MAX_FAILED_LOGINS - failed === 1 ? '' : 's'} left.`);
  }

  const studentActive = user.student && !user.student.deletedAt;
  const facultyActive = user.faculty && !user.faculty.deletedAt;

  const session = await createSession(user.id, user.role, user.email);
  await audit({
    action: 'auth.login',
    resourceType: 'User',
    resourceId: user.id,
    description: `${user.firstName} ${user.lastName} signed in`,
    ipAddress: ip,
  });

  return {
    userId: user.id,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    sessionId: session.id,
    themePreference: user.themePreference,
    studentId: studentActive ? user.student!.id : null,
    facultyId: facultyActive ? user.faculty!.id : null,
  };
}

export async function logout(user: AuthenticatedUser) {
  await destroySession(user.sessionId);
  await audit({
    action: 'auth.logout',
    resourceType: 'User',
    resourceId: user.id,
    description: `${user.firstName} ${user.lastName} signed out`,
  });
  return { loggedOut: true };
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  registerNumber: string;
  departmentId: string;
  phone?: string;
}

/**
 * Self-service student registration. Faculty and admin accounts are created by
 * an administrator (see people.service) so roles can never be self-assigned.
 */
export async function register(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();
  const registerNumber = input.registerNumber.trim().toUpperCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw badRequest('Enter a valid email address.');
  if (!input.firstName.trim() || !input.lastName.trim()) throw badRequest('Both first and last name are required.');
  if (!registerNumber) throw badRequest('Your register number is required.');

  const issues = passwordIssues(input.password);
  if (issues.length) throw badRequest(issues[0]);

  const [existingEmail, existingRegister, department] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.student.findUnique({ where: { registerNumber } }),
    prisma.department.findUnique({ where: { id: input.departmentId } }),
  ]);
  if (existingEmail) throw forbidden('That email address is already registered. Try signing in instead.');
  if (existingRegister) throw forbidden('That register number is already registered. Contact your administrator.');
  if (!department || department.deletedAt) throw notFound('Choose a valid department.');

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash: await hashPassword(input.password),
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
        departmentId: input.departmentId,
        semester: 1,
        admissionYear: new Date().getFullYear(),
        academicStatus: 'ACTIVE',
      },
    });
    return { user, student };
  });

  await audit({
    action: 'auth.register',
    resourceType: 'User',
    resourceId: created.user.id,
    description: `${created.user.firstName} ${created.user.lastName} registered as a student (${registerNumber})`,
    ipAddress: requestMeta().ip,
  });

  await notify(created.user.id, {
    type: 'SYSTEM',
    title: 'Welcome to CampusIQ',
    message: 'Your account is ready. Once your class is assigned you will see attendance, academics and results here.',
    link: '/profile',
  }).catch(() => undefined);

  const session = await createSession(created.user.id, created.user.role, created.user.email);
  return {
    userId: created.user.id,
    studentId: created.student.id,
    role: created.user.role,
    firstName: created.user.firstName,
    lastName: created.user.lastName,
    email: created.user.email,
    sessionId: session.id,
    themePreference: created.user.themePreference,
  };
}

export async function requestPasswordReset(email: string) {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({ where: { email: normalized, deletedAt: null } });

  // Always return the same shape so the endpoint cannot be used to enumerate accounts.
  const result = { sent: true, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString() };
  if (!user) return { ...result, devToken: undefined };

  await prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });

  const token = newResetToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashResetToken(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
    },
  });

  await notify(user.id, {
    type: 'SYSTEM',
    title: 'Password reset requested',
    message: `A reset link was requested for your account. If this was not you, change your password immediately.`,
    link: '/profile',
  }).catch(() => undefined);

  await audit({
    action: 'auth.reset.requested',
    resourceType: 'User',
    resourceId: user.id,
    description: `Password reset requested for ${user.email}`,
    ipAddress: requestMeta().ip,
  });

  // CampusIQ has no outbound mail transport configured by default, so the token
  // is surfaced in non-production environments to keep the flow testable.
  return { ...result, devToken: env().NODE_ENV === 'production' ? undefined : token };
}

export async function resetPassword(token: string, password: string) {
  const issues = passwordIssues(password);
  if (issues.length) throw badRequest(issues[0]);

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(token) } });
  if (!record || record.usedAt) throw badRequest('That reset link has already been used. Request a new one.');
  if (record.expiresAt < new Date()) throw badRequest('That reset link has expired. Request a new one.');

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(password), lockedUntil: null, failedLoginCount: 0 } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.session.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  await audit({
    action: 'auth.reset.completed',
    resourceType: 'User',
    resourceId: record.userId,
    description: 'Password reset completed — all sessions revoked',
    ipAddress: requestMeta().ip,
  });

  return { reset: true };
}

export async function changePassword(user: AuthenticatedUser, currentPassword: string, newPassword: string) {
  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) throw unauthorized();
  const valid = await verifyPassword(currentPassword, record.passwordHash);
  if (!valid) throw badRequest('Your current password is incorrect.');

  const issues = passwordIssues(newPassword);
  if (issues.length) throw badRequest(issues[0]);
  if (await verifyPassword(newPassword, record.passwordHash)) {
    throw badRequest('Choose a password you have not used before.');
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } }),
    prisma.session.updateMany({ where: { userId: user.id, id: { not: user.sessionId }, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);

  await audit({
    action: 'auth.password.change',
    resourceType: 'User',
    resourceId: user.id,
    description: 'Password changed — other sessions revoked',
    ipAddress: requestMeta().ip,
  });

  await notify(user.id, {
    type: 'SYSTEM',
    title: 'Password changed',
    message: 'Your CampusIQ password was changed and other devices were signed out.',
    link: '/profile',
  }).catch(() => undefined);

  return { changed: true };
}

export async function updateProfile(user: AuthenticatedUser, patch: { firstName?: string; lastName?: string; phone?: string | null; themePreference?: string }) {
  const data: Record<string, unknown> = {};
  if (patch.firstName !== undefined) {
    if (!patch.firstName.trim()) throw badRequest('First name cannot be empty.');
    data.firstName = patch.firstName.trim();
  }
  if (patch.lastName !== undefined) {
    if (!patch.lastName.trim()) throw badRequest('Last name cannot be empty.');
    data.lastName = patch.lastName.trim();
  }
  if (patch.phone !== undefined) data.phone = patch.phone || null;
  if (patch.themePreference !== undefined) {
    if (!['light', 'dark', 'system'].includes(patch.themePreference)) throw badRequest('Theme must be light, dark or system.');
    data.themePreference = patch.themePreference;
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data });
  await audit({
    action: 'profile.update',
    resourceType: 'User',
    resourceId: user.id,
    description: 'Updated their profile',
    previousValue: { firstName: user.firstName, lastName: user.lastName },
    newValue: patch,
  });
  return {
    id: updated.id,
    firstName: updated.firstName,
    lastName: updated.lastName,
    phone: updated.phone,
    themePreference: updated.themePreference,
  };
}

export async function listSessions(user: AuthenticatedUser) {
  const sessions = await prisma.session.findMany({
    where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  return sessions.map((s) => ({
    id: s.id,
    isCurrent: s.id === user.sessionId,
    userAgent: s.userAgent,
    ipAddress: s.ipAddress,
    createdAt: s.createdAt.toISOString(),
    lastUsedAt: s.lastUsedAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
  }));
}

export async function revokeSession(user: AuthenticatedUser, sessionId: string) {
  const session = await prisma.session.findFirst({ where: { id: sessionId, userId: user.id } });
  if (!session) throw notFound('That session does not exist.');
  if (session.id === user.sessionId) throw badRequest('You cannot revoke the session you are using. Sign out instead.');
  await prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  await audit({ action: 'auth.session.revoke', resourceType: 'Session', resourceId: sessionId, description: 'Revoked a signed-in session' });
  return { revoked: true };
}

export async function revokeAllOtherSessions(user: AuthenticatedUser) {
  const result = await destroyOtherSessions(user.id, user.sessionId);
  await audit({ action: 'auth.session.revokeAll', resourceType: 'Session', description: `Revoked ${result.count} other session(s)` });
  return { revoked: result.count };
}

export async function adminUnlockAccount(user: AuthenticatedUser, targetUserId: string) {
  if (user.role !== 'ADMIN') throw forbidden();
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw notFound('That account does not exist.');
  await prisma.user.update({ where: { id: targetUserId }, data: { lockedUntil: null, failedLoginCount: 0, status: target.status === 'SUSPENDED' ? 'ACTIVE' : target.status } });
  await audit({
    action: 'admin.unlock',
    resourceType: 'User',
    resourceId: targetUserId,
    description: `Unlocked ${target.email}`,
    previousValue: { lockedUntil: target.lockedUntil },
    userId: user.id,
  });
  return { unlocked: true };
}

export async function resetUserPassword(user: AuthenticatedUser, targetUserId: string) {
  if (user.role !== 'ADMIN') throw forbidden();
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw notFound('That account does not exist.');
  const temporary = `Campus@${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.floor(100 + Math.random() * 899)}`;
  await prisma.$transaction([
    prisma.user.update({ where: { id: targetUserId }, data: { passwordHash: await hashPassword(temporary), lockedUntil: null, failedLoginCount: 0 } }),
    prisma.session.updateMany({ where: { userId: targetUserId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await audit({
    action: 'admin.password.reset',
    resourceType: 'User',
    resourceId: targetUserId,
    description: `Reset the password for ${target.email}`,
    userId: user.id,
  });
  return { temporaryPassword: temporary };
}
