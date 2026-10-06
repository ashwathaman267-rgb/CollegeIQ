import { apiHandler, ok } from '@/server/api/handler';
import { listSessions, revokeAllOtherSessions } from '@/server/services/auth.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ user }) => ok(await listSessions(user)));

export const DELETE = apiHandler(async ({ user }) => ok(await revokeAllOtherSessions(user)));
