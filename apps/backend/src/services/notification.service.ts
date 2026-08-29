import { prisma } from '@farmassist/database';

/**
 * In-app notifications. The WhatsApp channel writes here too, so a farmer who
 * was warned over WhatsApp sees the same alert when they later open the
 * dashboard to review.
 */

export interface NotificationInput {
  userId: string;
  message: string;
  title?: string | null;
  /** ALERT or INFO. */
  type?: string;
}

export async function listNotificationsForUser(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createNotification(input: NotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      message: input.message,
      title: input.title ?? null,
      type: input.type ?? 'INFO',
    },
  });
}

/**
 * Ownership is part of the where clause rather than a separate read, so a
 * notification belonging to someone else is simply not found.
 */
export async function markNotificationRead(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
  return count > 0;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return count;
}
