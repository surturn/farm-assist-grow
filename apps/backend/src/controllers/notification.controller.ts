import { Request, Response } from 'express';
import { prisma } from '@farmassist/database';

export const getNotifications = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });

        return res.status(200).json(notifications);
    } catch (error: any) {
        console.error('Get Notifications Error:', error);
        return res.status(500).json({ error: 'Failed to fetch notifications', details: error.message });
    }
};

export const markAsRead = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        
        // Ensure the notification belongs to this user
        const updated = await prisma.notification.updateMany({
            where: { id, userId },
            data: { read: true }
        });

        if (updated.count === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        return res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('Mark Notification Read Error:', error);
        return res.status(500).json({ error: 'Failed to mark notification as read', details: error.message });
    }
};

export const markAllAsRead = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const updated = await prisma.notification.updateMany({
            where: { userId, read: false },
            data: { read: true }
        });

        return res.status(200).json({ success: true, count: updated.count });
    } catch (error: any) {
        console.error('Mark All Notifications Read Error:', error);
        return res.status(500).json({ error: 'Failed to mark all as read', details: error.message });
    }
};
