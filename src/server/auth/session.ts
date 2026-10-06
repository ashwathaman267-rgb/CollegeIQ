import { cookies, headers } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import crypto from 'node:crypto';

import { env } from '@/lib/env';
import { prisma } from '@/lib/db';
import type { Role } from '@prisma/client';

export const SESSION_COOKIE = 'campusiq_session';

export interface SessionPayload {
  sub: string; // user id
  sid: string; // session row id
  role: Role;
  email: string;
}

function secretKey() {
  return new TextEncoder().encode(env().AUTH_SECRET);
}

export function ttlSeconds() {
  return env().SESSION_TTL_DAYS * 24 * 60 * 60;
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role, email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setJti(payload.sid)
    .setIssuedAt()
    .setIssuer('campusiq')
    .setAudience('campusiq-web')
    .setExpirationTime(`${ttlSeconds()}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: 'campusiq',
      audience: 'campusiq-web',
      algorithms: ['HS256'],
    });
    if (!payload.sub || !payload.jti) return null;
    return {
      sub: payload.sub,
      sid: payload.jti,
      role: (payload.role as Role) ?? 'STUDENT',
      email: String(payload.email ?? ''),
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(token: string) {
  cookies().set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: env().COOKIE_SECURE,
    path: '/',
    maxAge: ttlSeconds(),
  });
}

export function clearSessionCookie() {
  cookies().set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: env().COOKIE_SECURE,
    path: '/',
    maxAge: 0,
  });
}

export function requestMeta() {
  const h = headers();
  const forwarded = h.get('x-forwarded-for');
  const ip =
    (forwarded ? forwarded.split(',')[0] : undefined)?.trim() ||
    h.get('x-real-ip') ||
    undefined;
  return { ip, userAgent: h.get('user-agent')?.slice(0, 300) ?? undefined };
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  themePreference: string;
  status: string;
  sessionId: string;
  studentId?: string | null;
  facultyId?: string | null;
  registerNumber?: string | null;
  employeeId?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  classId?: string | null;
  className?: string | null;
}

/**
 * Resolve the signed-in user from the session cookie.
 * The JWT gives us identity without a query; the database check guarantees the
 * session has not been revoked and the account is still active.
 */
export async function getAuthUser(): Promise<AuthenticatedUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const session = await prisma.session.findUnique({ where: { id: payload.sid } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      student: { include: { class: true, department: true } },
      faculty: { include: { department: true } },
    },
  });
  if (!user || user.deletedAt || user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
    return null;
  }

  // Throttle the "last used" write so page loads stay cheap.
  if (Date.now() - session.lastUsedAt.getTime() > 5 * 60 * 1000) {
    prisma.session
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    themePreference: user.themePreference,
    status: user.status,
    sessionId: session.id,
    studentId: user.student?.id ?? null,
    facultyId: user.faculty?.id ?? null,
    registerNumber: user.student?.registerNumber ?? null,
    employeeId: user.faculty?.employeeId ?? null,
    departmentId: user.student?.departmentId ?? user.faculty?.departmentId ?? null,
    departmentName: user.student?.department?.name ?? user.faculty?.department?.name ?? null,
    classId: user.student?.classId ?? null,
    className: user.student?.class?.name ?? null,
  };
}

export async function createSession(userId: string, role: Role, email: string) {
  const { ip, userAgent } = requestMeta();
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + ttlSeconds() * 1000);

  const session = await prisma.session.create({
    data: { userId, tokenHash, userAgent, ipAddress: ip, expiresAt },
  });

  const jwt = await signSessionToken({ sub: userId, sid: session.id, role, email });
  setSessionCookie(jwt);
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date(), failedLoginCount: 0 } });
  return session;
}

export async function destroySession(sessionId: string) {
  await prisma.session
    .update({ where: { id: sessionId }, data: { revokedAt: new Date() } })
    .catch(() => undefined);
  clearSessionCookie();
}

export async function destroyOtherSessions(userId: string, keepSessionId: string) {
  return prisma.session.updateMany({
    where: { userId, id: { not: keepSessionId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function hashResetToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function newResetToken() {
  return crypto.randomBytes(24).toString('base64url');
}
