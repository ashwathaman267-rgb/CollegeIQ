import { apiHandler, ok, readPagination } from '@/server/api/handler';
import { listNotifications, markAllNotificationsRead, unreadCount } from '@/server/services/notification.service';
import { notificationPreferenceSchema } from '@/validations';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async ({ searchParams, user }) => {
  const { page, pageSize } = readPagination(searchParams, 15);
  const preferences = notificationPreferenceSchema.parse({
    unreadOnly: searchParams.get('unreadOnly') ?? undefined,
    type: searchParams.get('type') ?? undefined,
  });
  const [result, unread] = await Promise.all([
    listNotifications({ userId: user.id, page, pageSize, unreadOnly: preferences.unreadOnly, type: preferences.type }),
    unreadCount(user.id),
  ]);
  return ok({ items: result.items, unread }, result.meta);
});

export const PATCH = apiHandler(async ({ user }) => ok(await markAllNotificationsRead(user.id)));
