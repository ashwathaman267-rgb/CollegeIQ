import { apiHandler, ok } from '@/server/api/handler';
import { deleteJobDescription, getJobDescription } from '@/server/services/career.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ params }) => ok(await getJobDescription(params.id)), { roles: ['STUDENT'] });

export const DELETE = apiHandler(async ({ params, user }) =>
  ok(await deleteJobDescription(params.id, user.studentId ?? null, user.role, user.id)),
  { roles: ['STUDENT', 'ADMIN'] },
);
