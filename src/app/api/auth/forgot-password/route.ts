import { apiHandler, ok } from '@/server/api/handler';
import { RATE_LIMITS } from '@/server/middleware/rate-limit';
import { requestPasswordReset } from '@/server/services/auth.service';
import { forgotPasswordSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(
  async ({ body }) => ok(await requestPasswordReset(forgotPasswordSchema.parse(body).email)),
  { auth: false, rateLimit: RATE_LIMITS.passwordReset },
);
