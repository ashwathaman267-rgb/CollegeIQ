import { apiHandler, ok } from '@/server/api/handler';
import { RATE_LIMITS } from '@/server/middleware/rate-limit';
import { register } from '@/server/services/auth.service';
import { registerSchema } from '@/validations';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
  const departments = await prisma.department.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, code: true },
  });
  return ok({ departments });
}, { auth: false });

export const POST = apiHandler(
  async ({ body }) => ok(await register(registerSchema.parse(body))),
  { auth: false, rateLimit: RATE_LIMITS.auth },
);
