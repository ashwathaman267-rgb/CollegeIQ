import { apiHandler, ok } from '@/server/api/handler';
import { RATE_LIMITS } from '@/server/middleware/rate-limit';
import { login } from '@/server/services/auth.service';
import { loginSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(
  async ({ body }) => ok(await login(loginSchema.parse(body))),
  { auth: false, rateLimit: RATE_LIMITS.auth },
);
