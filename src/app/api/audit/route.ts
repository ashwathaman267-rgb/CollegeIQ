import { apiHandler, ok, readPagination } from '@/server/api/handler';
import { listAuditLogs } from '@/server/services/audit.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams }) => {
  const { page, pageSize, search } = readPagination(searchParams, 25);
  const result = await listAuditLogs({
    page,
    pageSize,
    search,
    resourceType: searchParams.get('resourceType') ?? undefined,
    action: searchParams.get('action') ?? undefined,
    userId: searchParams.get('userId') ?? undefined,
    from: searchParams.get('from') ? new Date(searchParams.get('from') as string) : undefined,
    to: searchParams.get('to') ? new Date(searchParams.get('to') as string) : undefined,
  });
  return ok(result.items, result.meta);
}, { roles: ['ADMIN'] });
