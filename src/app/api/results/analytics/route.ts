import { apiHandler, ok } from '@/server/api/handler';
import { resultAnalytics } from '@/server/services/results.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams }) =>
  ok(await resultAnalytics({ departmentId: searchParams.get('departmentId') ?? undefined })),
  { roles: ['ADMIN', 'FACULTY'] },
);
