import { apiHandler, ok } from '@/server/api/handler';
import { attendanceHeatmap } from '@/server/services/analytics.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams }) =>
  ok(await attendanceHeatmap({ departmentId: searchParams.get('departmentId') ?? undefined })),
  { roles: ['ADMIN', 'FACULTY'] },
);
