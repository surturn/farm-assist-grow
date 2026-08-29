import { Request, Response } from 'express';
import * as notificationService from '../services/notification.service';

export const getNotifications = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const notifications = await notificationService.listNotificationsForUser(userId);
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

        const marked = await notificationService.markNotificationRead(userId, req.params.id);
        if (!marked) {
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

        const count = await notificationService.markAllNotificationsRead(userId);
        return res.status(200).json({ success: true, count });
    } catch (error: any) {
        console.error('Mark All Notifications Read Error:', error);
        return res.status(500).json({ error: 'Failed to mark all as read', details: error.message });
    }
};
