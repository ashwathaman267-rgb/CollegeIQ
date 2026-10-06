import { apiHandler, ok } from '@/server/api/handler';
import { deleteNotification, markNotificationRead } from '@/server/services/notification.service';

export const dynamic = 'force-dynamic';

export const PATCH = apiHandler(async ({ params, body, user }) => {
  const read = (body as { read?: boolean } | undefined)?.read ?? true;
  return ok(await markNotificationRead(params.id, user.id, read));
});

export const DELETE = apiHandler(async ({ params, user }) => ok(await deleteNotification(params.id, user.id)));
