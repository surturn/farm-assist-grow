import { Request, Response } from 'express';
import { prisma } from '@farmassist/database';

export const getDashboardData = async (req: Request, res: Response): Promise<any> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Fetch User Profile from Prisma
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        const userRegion = user?.region || 'Central Kenya';
        const systemMode = 'basic'; // Default for MVP

        const farmId = req.query.farmId as string | undefined;

        // Fetch User's Farms
        const userFarms = await prisma.farm.findMany({
            where: { tenant: { members: { some: { userId } } } },
            select: { id: true, name: true, location: true }
        });

        // Fetch Notifications from Prisma
        const alerts = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        const unreadCount = await prisma.notification.count({
            where: { userId, read: false }
        });

        // Fetch Scans from Prisma
        const scans = await prisma.scan.findMany({
            where: { userId, ...(farmId ? { farmId } : {}) },
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        const totalScans = await prisma.scan.count({
            where: { userId, ...(farmId ? { farmId } : {}) }
        });

        // Fetch News Items
        const news = await prisma.newsItem.findMany({
            orderBy: { publishedAt: 'desc' },
            take: 5
        });

        // Fetch Dynamic Stats
        const farmsCount = userFarms.length;
        const cropsCount = await prisma.crop.count({
             where: { farm: farmId ? { id: farmId } : { tenant: { members: { some: { userId } } } } }
        });
        const tasksCount = await prisma.task.count({
            where: { 
                assignee: { id: userId }, 
                status: { not: "COMPLETED" },
                ...(farmId ? { farmId } : {})
            }
        });

        // Recommendations (Can be dynamic based on recent scans)
        const recommendations = [
            { id: "1", title: "Apply Copper Fungicide", desc: "Based on recent Early Blight detection" }
        ];

        return res.status(200).json({
            user: {
                firstName: user?.firstName,
                lastName: user?.lastName
            },
            totalScans,
            recentScans: scans,
            alerts,
            news,
            recommendations,
            userRegion,
            systemMode,
            farms: userFarms,
            activeFarmId: farmId || (userFarms.length > 0 ? userFarms[0].id : null),
            stats: {
                alerts: unreadCount,
                farms: farmsCount,
                crops: cropsCount,
                pendingTasks: tasksCount
            }
        });
    } catch (error: any) {
        console.error('Dashboard Data Error:', error);
        return res.status(500).json({ error: 'Failed to fetch dashboard data', details: error.message });
    }
};
