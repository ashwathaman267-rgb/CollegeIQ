import { apiHandler, ok } from '@/server/api/handler';
import { adminUnlockAccount, resetUserPassword } from '@/server/services/auth.service';
import { getStudentProfile } from '@/server/services/people.service';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async ({ params, user, searchParams }) => {
  const student = await getStudentProfile(params.id);
  if (searchParams.get('action') === 'reset-password') {
    return ok(await resetUserPassword(user, student.userId));
  }
  return ok(await adminUnlockAccount(user, student.userId));
}, { roles: ['ADMIN'] });
