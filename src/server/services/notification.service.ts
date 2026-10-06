import type { NotificationType, Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';

export interface NotificationInput {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Prisma.InputJsonValue;
}

/** Deliver a notification to one user. */
export async function notify(userId: string, input: NotificationInput) {
  return prisma.notification.create({
    data: {
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}

/** Deliver the same notification to many users (bulk insert). */
export async function notifyMany(userIds: string[], input: NotificationInput) {
  const unique = Array.from(new Set(userIds)).filter(Boolean);
  if (unique.length === 0) return { count: 0 };
  const result = await prisma.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    })),
  });
  return { count: result.count };
}

export interface ListNotificationsInput {
  userId: string;
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
}

export async function listNotifications(input: ListNotificationsInput) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 15));
  const where: Prisma.NotificationWhereInput = {
    userId: input.userId,
    ...(input.unreadOnly ? { isRead: false } : {}),
    ...(input.type ? { type: input.type } : {}),
  };

  const [total, unread, items] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: input.userId, isRead: false } }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items,
    unread,
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function markNotificationRead(id: string, userId: string, read = true) {
  return prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: read, readAt: read ? new Date() : null },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function deleteNotification(id: string, userId: string) {
  return prisma.notification.deleteMany({ where: { id, userId } });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}
