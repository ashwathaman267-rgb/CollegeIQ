import { apiHandler, ok } from '@/server/api/handler';
import { RATE_LIMITS } from '@/server/middleware/rate-limit';
import { globalSearch } from '@/server/services/search.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams, user }) => ok(await globalSearch(searchParams.get('q') ?? '', user)), {
  rateLimit: RATE_LIMITS.search,
});
