import { Request, Response } from 'express';
import { dbAdmin } from '../config/firebase';
import { prisma } from '../db/prisma';

export const getDashboardData = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Fetch User Profile
        const userDoc = await dbAdmin.collection('users').doc(userId).get();
        const userRegion = userDoc.exists ? userDoc.data()?.location || 'Central Kenya' : 'Central Kenya';

        // Fetch Notifications
        const notifSnapshot = await dbAdmin.collection('notifications')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .get();
        
        const alerts = notifSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const unreadCount = alerts.filter((a: any) => !a.read).length;

        // Fetch Scans
        const scansSnapshot = await dbAdmin.collection('scans')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();
        
        const scans = scansSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        const stats = {
            alerts: unreadCount,
            farms: 1, // Mock
            crops: 5, // Mock
            trees: 12 // Mock
        };

        return res.status(200).json({
            stats,
            recentAlerts: alerts.slice(0, 5),
            recentScans: scans,
            userRegion
        });
    } catch (error: any) {
        console.error('Dashboard Data Error:', error);
        return res.status(500).json({ error: 'Failed to fetch dashboard data', details: error.message });
    }
};
