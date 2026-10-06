import { apiHandler, ok } from '@/server/api/handler';
import { getMarksheet } from '@/server/services/academics.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ params }) => ok(await getMarksheet(params.id)), {
  roles: ['ADMIN', 'FACULTY'],
});
