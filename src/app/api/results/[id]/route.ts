import { apiHandler, ok } from '@/server/api/handler';
import { deleteUniversityResult, getResultDetail } from '@/server/services/results.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ params, searchParams }) => {
  const detail = await getResultDetail(params.id, {
    page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
    pageSize: searchParams.get('pageSize') ? Number(searchParams.get('pageSize')) : undefined,
    status: searchParams.get('status') ?? undefined,
    search: searchParams.get('search') ?? undefined,
  });
  return ok(detail, detail.meta);
}, { roles: ['ADMIN', 'FACULTY'] });

export const DELETE = apiHandler(async ({ params, user }) => ok(await deleteUniversityResult(params.id, user.id)), {
  roles: ['ADMIN'],
});
