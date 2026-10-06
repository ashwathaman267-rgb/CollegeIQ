import { apiHandler, ok } from '@/server/api/handler';
import { institutionAnalytics } from '@/server/services/analytics.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams }) =>
  ok(
    await institutionAnalytics({
      departmentId: searchParams.get('departmentId') ?? undefined,
      classId: searchParams.get('classId') ?? undefined,
    }),
  ),
  { roles: ['ADMIN', 'FACULTY'] },
);
