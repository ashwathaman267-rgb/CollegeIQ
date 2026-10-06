import { apiHandler, ok } from '@/server/api/handler';
import { changePassword } from '@/server/services/auth.service';
import { changePasswordSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async ({ user, body }) => {
  const input = changePasswordSchema.parse(body);
  return ok(await changePassword(user, input.currentPassword, input.newPassword));
});
