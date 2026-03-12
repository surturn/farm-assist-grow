import { Request, Response } from 'express';
import { dbAdmin } from '@farmassist/firebase-admin';

export const getNotifications = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const notifSnapshot = await dbAdmin.collection('notifications')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        
        const notifications = notifSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        return res.status(200).json(notifications);
    } catch (error: any) {
        console.error('Get Notifications Error:', error);
        return res.status(500).json({ error: 'Failed to fetch notifications', details: error.message });
    }
};

export const markAsRead = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const noteRef = dbAdmin.collection('notifications').doc(id);
        await noteRef.update({ read: true });

        return res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('Mark Notification Read Error:', error);
        return res.status(500).json({ error: 'Failed to mark notification as read', details: error.message });
    }
};

export const markAllAsRead = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const batch = dbAdmin.batch();
        const unreadSnapshot = await dbAdmin.collection('notifications')
            .where('userId', '==', userId)
            .where('read', '==', false)
            .get();

        unreadSnapshot.forEach(doc => {
            batch.update(doc.ref, { read: true });
        });

        await batch.commit();

        return res.status(200).json({ success: true, count: unreadSnapshot.size });
    } catch (error: any) {
        console.error('Mark All Notifications Read Error:', error);
        return res.status(500).json({ error: 'Failed to mark all as read', details: error.message });
    }
};
