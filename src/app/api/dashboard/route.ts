import { apiHandler, ok } from '@/server/api/handler';
import { dashboardFor } from '@/server/services/dashboard.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ user }) => ok(await dashboardFor(user)));
