import { apiHandler, ok } from '@/server/api/handler';
import { RATE_LIMITS } from '@/server/middleware/rate-limit';
import { saveMarks } from '@/server/services/academics.service';
import { saveMarksSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async ({ params, body, user }) => {
  const { entries } = saveMarksSchema.parse(body);
  return ok(await saveMarks(params.id, entries, user.id, user.role));
}, { roles: ['ADMIN', 'FACULTY'], rateLimit: RATE_LIMITS.write });
