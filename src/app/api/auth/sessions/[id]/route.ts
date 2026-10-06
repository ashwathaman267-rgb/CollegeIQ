import { apiHandler, ok } from '@/server/api/handler';
import { revokeSession } from '@/server/services/auth.service';

export const dynamic = 'force-dynamic';

export const DELETE = apiHandler(async ({ user, params }) => ok(await revokeSession(user, params.id)));
