import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

import { AppError, internal, forbidden, unauthorized, notFound, conflict } from './errors';
import { getAuthUser, type AuthenticatedUser } from '@/server/auth/session';
import { enforceRateLimit, type RateLimitOptions } from '@/server/middleware/rate-limit';
import type { Role } from '@prisma/client';

export interface ApiContext<Params = Record<string, string>> {
  request: Request;
  params: Params;
  searchParams: URLSearchParams;
  user: AuthenticatedUser;
  /** Raw JSON body (already parsed). `undefined` when the request has none. */
  body: unknown;
  formData: () => Promise<FormData>;
  ip?: string;
}

export interface ApiRouteOptions<Params> {
  /** Require a signed-in user (default: true). */
  auth?: boolean;
  /** Allow only these roles. */
  roles?: Role[];
  /** Require the user to have a linked Student profile. */
  student?: boolean;
  /** Require the user to have a linked Faculty profile. */
  facultyProfile?: boolean;
  /** Typed route params. */
  params?: (raw: Record<string, string>) => Params;
  /**
   * Sliding-window rate limit for this route. Applied before authentication and
   * keyed by IP so unauthenticated floods are contained too.
   */
  rateLimit?: RateLimitOptions;
}

type Handler<Params, Result> = (ctx: ApiContext<Params>) => Promise<Result>;

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

export interface ApiSuccess<T> {
  data: T;
  meta?: ApiMeta;
}

function errorBody(err: unknown) {
  if (err instanceof AppError) {
    return { status: err.status, code: err.code, message: err.message, details: err.details };
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      field: i.path.join('.') || undefined,
      message: i.message,
      code: i.code,
    }));
    return {
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Some of the submitted values are invalid.',
      details,
    };
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[] | string | undefined) ?? [];
        const fields = Array.isArray(target) ? target.join(', ') : String(target);
        return {
          status: 409,
          code: 'DUPLICATE_RECORD',
          message: `A record with the same ${fields || 'unique value'} already exists.`,
          details: { fields },
        };
      }
      case 'P2025':
        return { status: 404, code: 'NOT_FOUND', message: 'That record no longer exists.' };
      case 'P2003':
        return {
          status: 409,
          code: 'REFERENCE_CONFLICT',
          message: 'That record is still referenced elsewhere and cannot be changed this way.',
        };
      case 'P2014':
        return {
          status: 409,
          code: 'RELATION_REQUIRED',
          message: 'This change would break a required relationship.',
        };
      default:
        return {
          status: 400,
          code: `DATABASE_${err.code}`,
          message: 'The database rejected that change. Please check your input.',
        };
    }
  }
  if (err instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 400,
      code: 'INVALID_QUERY',
      message: 'That request could not be understood by the database layer.',
    };
  }
  return null;
}

/**
 * Wrap a route handler with authentication, authorization, body parsing and
 * uniform error responses. Handlers return plain data; the wrapper serialises
 * it into `{ data, meta }`.
 */
export function apiHandler<Params = Record<string, string>, Result = unknown>(
  handler: Handler<Params, Result>,
  options: ApiRouteOptions<Params> = {},
) {
  const {
    auth = true,
    roles,
    student: needsStudent,
    facultyProfile: needsFaculty,
    params: mapParams,
    rateLimit,
  } = options;

  return async function route(request: Request, context?: { params: Record<string, string> }) {
    try {
      if (rateLimit) enforceRateLimit(rateLimit);

      const url = new URL(request.url);
      const rawParams = context?.params ?? {};
      const params = mapParams ? mapParams(rawParams) : (rawParams as Params);

      let user: AuthenticatedUser | null = null;
      if (auth) {
        user = await getAuthUser();
        if (!user) throw unauthorized();
        if (user.status !== 'ACTIVE' && user.role !== 'ADMIN') {
          throw forbidden('This account is not active. Contact your administrator.');
        }
        if (roles && !roles.includes(user.role)) {
          throw forbidden('You do not have permission to do that.');
        }
        if (needsStudent && !user.studentId) throw forbidden('A student profile is required.');
        if (needsFaculty && !user.facultyId) throw forbidden('A faculty profile is required.');
      }

      let body: unknown;
      const contentType = request.headers.get('content-type') ?? '';
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        if (contentType.includes('application/json')) {
          const text = await request.text();
          body = text ? JSON.parse(text) : undefined;
        } else if (!contentType.includes('multipart/form-data')) {
          const text = await request.text();
          if (text) {
            try {
              body = JSON.parse(text);
            } catch {
              body = text;
            }
          }
        }
      }

      const result = await handler({
        request,
        params,
        searchParams: url.searchParams,
        user: user as AuthenticatedUser,
        body,
        formData: () => request.formData(),
        ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
      });

      if (result instanceof NextResponse || result instanceof Response) {
        return result as unknown as NextResponse;
      }

      const payload = result as ApiSuccess<unknown> | unknown;
      const isEnvelope =
        payload !== null &&
        typeof payload === 'object' &&
        'data' in (payload as Record<string, unknown>) &&
        Object.keys(payload as Record<string, unknown>).every((k) => ['data', 'meta'].includes(k));

      return NextResponse.json(isEnvelope ? payload : { data: payload }, {
        status: request.method === 'POST' && !isEnvelope ? 201 : 200,
      });
    } catch (err) {
      const mapped = errorBody(err);
      if (mapped) {
        if (mapped.status >= 500) console.error('[api]', err);
        return NextResponse.json({ error: mapped }, { status: mapped.status });
      }
      console.error('[api] unhandled error', err);
      const fallback = internal();
      return NextResponse.json(
        {
          error: {
            status: fallback.status,
            code: fallback.code,
            message: fallback.message,
          },
        },
        { status: 500 },
      );
    }
  };
}

/** Convenience factories for the envelope shape. */
export const ok = <T>(data: T, meta?: ApiMeta): ApiSuccess<T> => (meta ? { data, meta } : { data });

export const paginated = <T>(data: T[], meta: Required<ApiMeta>): ApiSuccess<T[]> => ({
  data,
  meta,
});

export interface PaginationInput {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

const MAX_PAGE_SIZE = 200;

/** Parse & clamp pagination/search params — never trust client-supplied sizes. */
export function readPagination(searchParams: URLSearchParams, defaultPageSize = 20): PaginationInput {
  const page = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const requested = Number(searchParams.get('pageSize') ?? defaultPageSize) || defaultPageSize;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requested));
  const dir = (searchParams.get('sortDir') ?? 'asc').toLowerCase();
  return {
    page,
    pageSize,
    search: searchParams.get('search')?.trim() || undefined,
    sortBy: searchParams.get('sortBy')?.trim() || undefined,
    sortDir: dir === 'desc' ? 'desc' : 'asc',
  };
}

export function pageMeta(page: number, pageSize: number, total: number): Required<ApiMeta> {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export { AppError, notFound, conflict };
