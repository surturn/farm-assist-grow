import { Request, Response } from 'express';
import { dbAdmin } from '@farmassist/firebase-admin';
import { prisma } from '@farmassist/database';

export const getDashboardData = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.uid;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Fetch User Profile
        const userDoc = await dbAdmin.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const userRegion = userData?.location || 'Central Kenya';
        const systemMode = userData?.systemMode || 'basic'; // "basic", "iot", or "hybrid"

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

        const scansSnapshotAll = await dbAdmin.collection('scans')
            .where('userId', '==', userId)
            .get();
            
        const totalScans = scansSnapshotAll.size;

        // In a real app we would compute or fetch recommendations based on scans/weather
        const recommendations = [
            { id: "1", title: "Apply Copper Fungicide", desc: "Based on recent Early Blight detection" }
        ];

        return res.status(200).json({
            totalScans,
            recentScans: scans,
            alerts: alerts.slice(0, 5),
            recommendations,
            userRegion,
            systemMode
        });
    } catch (error: any) {
        console.error('Dashboard Data Error:', error);
        return res.status(500).json({ error: 'Failed to fetch dashboard data', details: error.message });
    }
};
