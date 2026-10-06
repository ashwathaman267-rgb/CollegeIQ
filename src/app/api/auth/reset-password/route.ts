import { apiHandler, ok } from '@/server/api/handler';
import { RATE_LIMITS } from '@/server/middleware/rate-limit';
import { resetPassword } from '@/server/services/auth.service';
import { resetPasswordSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async ({ body }) => {
  const input = resetPasswordSchema.parse(body);
  return ok(await resetPassword(input.token, input.password));
}, { auth: false, rateLimit: RATE_LIMITS.passwordReset });
