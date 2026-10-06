import { apiHandler, ok } from '@/server/api/handler';
import { logout } from '@/server/services/auth.service';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async ({ user }) => ok(await logout(user)));
